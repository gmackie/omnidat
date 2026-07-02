export type ShadyBankEndpoint = {
  method: "GET" | "POST";
  path: string;
  purpose: string;
};

export type ShadyBankClientConfig = {
  baseUrl?: string;
  merchantToken?: string;
  fetch?: typeof fetch;
};

type ShadyBankPanPurchaseInput = {
  amount: number;
  pan: string;
  otp?: string;
  description?: string;
};

type ShadyBankTrack2PurchaseInput = {
  amount: number;
  track2: string;
  description?: string;
};

export type ShadyBankPurchaseInput =
  | ShadyBankPanPurchaseInput
  | ShadyBankTrack2PurchaseInput;

export type ShadyBankPurchaseResult = {
  authCode: string;
  captured: boolean;
  authorizeEndpoint: string;
  captureEndpoint: string;
  transcript: string;
};

const sourceRepo = "/Volumes/dev/shady/shadybank";

const endpoints: ShadyBankEndpoint[] = [
  {
    method: "POST",
    path: "/api/login",
    purpose: "Obtain account bearer token",
  },
  { method: "GET", path: "/api/check", purpose: "Validate bearer token" },
  { method: "GET", path: "/api/balance", purpose: "Read account balance" },
  {
    method: "GET",
    path: "/api/transactions",
    purpose: "Read account transaction history",
  },
  {
    method: "GET",
    path: "/api/authorizations",
    purpose: "Read pending authorizations",
  },
  {
    method: "POST",
    path: "/api/authorize",
    purpose: "Authorize merchant purchase",
  },
  {
    method: "POST",
    path: "/api/capture",
    purpose: "Capture authorized purchase",
  },
  { method: "POST", path: "/api/void", purpose: "Void pending authorization" },
  { method: "POST", path: "/api/reverse", purpose: "Reverse posted purchase" },
  { method: "POST", path: "/api/credit", purpose: "Issue points credit" },
  {
    method: "POST",
    path: "/api/activate",
    purpose: "Activate card or wristband",
  },
];

function normalizeBaseUrl(baseUrl?: string) {
  return baseUrl?.replace(/\/+$/, "");
}

function amountString(amount: number) {
  return amount.toFixed(2);
}

function bearerHeaders(merchantToken: string) {
  return {
    Authorization: `Bearer ${merchantToken}`,
  };
}

function redactPan(value: string) {
  const suffix = value.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `************${suffix}`;
}

function track2Pan(track2: string) {
  return track2.match(/;(?<pan>\d{8,19})=/)?.groups?.pan ?? track2;
}

function merchantLinkStatus(
  baseUrl: string | undefined,
  merchantToken: string | undefined,
) {
  if (!baseUrl) {
    return "api-url-missing";
  }
  if (!merchantToken) {
    return "merchant-token-missing";
  }
  return "ready";
}

async function readResponseText(response: Response) {
  const text = await response.text();
  return text.trim();
}

export function getShadyBankIntegrationProfile(
  config: ShadyBankClientConfig = {},
) {
  const baseUrl = normalizeBaseUrl(
    config.baseUrl ?? process.env.SHADYBANK_API_URL,
  );
  const merchantToken =
    config.merchantToken ?? process.env.SHADYBANK_MERCHANT_TOKEN;

  return {
    protocol: "SHADYBANK-SHADYBUCKS-HTTP-1",
    configured: Boolean(baseUrl && merchantToken),
    sourceRepo,
    baseUrl: baseUrl ?? null,
    merchantAuth: merchantToken ? "bearer-token" : "missing",
    merchantLinkStatus: merchantLinkStatus(baseUrl, merchantToken),
    endpoints,
  };
}

export function createShadyBankClient(config: ShadyBankClientConfig = {}) {
  const profile = getShadyBankIntegrationProfile(config);
  const fetcher = config.fetch ?? fetch;
  const merchantToken =
    config.merchantToken ?? process.env.SHADYBANK_MERCHANT_TOKEN;

  async function postForm(path: string, body: URLSearchParams) {
    if (!profile.baseUrl || !merchantToken) {
      throw new Error("Shady Bank integration is not configured");
    }

    const response = await fetcher(`${profile.baseUrl}${path}`, {
      method: "POST",
      headers: bearerHeaders(merchantToken),
      body,
    });

    if (!response.ok) {
      throw new Error(`Shady Bank ${path} failed with ${response.status}`);
    }

    return response;
  }

  return {
    profile,
    async authorizeAndCapture(
      input: ShadyBankPurchaseInput,
    ): Promise<ShadyBankPurchaseResult> {
      const authorizeBody = new URLSearchParams({
        amount: amountString(input.amount),
      });
      const paymentLine =
        "track2" in input
          ? `TRACK2 ${redactPan(track2Pan(input.track2))}`
          : `PAN ${redactPan(input.pan)}`;
      if ("track2" in input) {
        authorizeBody.set("track2", input.track2);
      } else {
        authorizeBody.set("pan", input.pan);
      }
      if ("otp" in input && input.otp) {
        authorizeBody.set("otp", input.otp);
      }

      const authorizeResponse = await postForm("/api/authorize", authorizeBody);
      const authCode = await readResponseText(authorizeResponse);

      const captureBody = new URLSearchParams({
        amount: amountString(input.amount),
        auth_code: authCode,
      });
      if (input.description) {
        captureBody.set("description", input.description);
      }

      await postForm("/api/capture", captureBody);

      return {
        authCode,
        captured: true,
        authorizeEndpoint: "/api/authorize",
        captureEndpoint: "/api/capture",
        transcript: [
          "SHADYBANK POST /api/authorize",
          paymentLine,
          `AMOUNT ${amountString(input.amount)} SHDY`,
          `AUTH ${authCode}`,
          "SHADYBANK POST /api/capture",
          "CAPTURE 204",
        ].join("\n"),
      };
    },
  };
}
