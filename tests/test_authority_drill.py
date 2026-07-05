import json
import unittest

from tools.omnidat_authority_drill import run_authority_drill


class FakeResponse:
    def __init__(self, body):
        self._body = json.dumps(body).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class DrillTransport:
    """Fake cloud that tracks authority across transfer calls."""

    def __init__(self):
        self.holder = "field"
        self.holder_source = "field-kit-01"
        self.epoch = 1
        self.calls = []

    def __call__(self, request):
        procedure = request.full_url.rsplit("/", 1)[-1]
        body = json.loads(request.data.decode("utf-8"))["json"]
        self.calls.append((procedure, body))
        if procedure == "omnidat.authorityStatus":
            data = {
                "authority": {"holder": self.holder, "epoch": self.epoch},
                "sources": [
                    {"sourceId": "field-kit-01", "lastPushedSeq": 12, "lastSyncAt": "t"}
                ],
            }
        elif procedure == "omnidat.transferAuthority":
            self.holder = body["toHolder"]
            self.holder_source = body["toSourceId"]
            self.epoch += 1
            data = {
                "eventId": body["eventId"],
                "epoch": self.epoch,
                "holder": self.holder,
                "holderSourceId": self.holder_source,
                "fenceSeq": 12,
            }
        else:  # syncPull
            data = {
                "entries": [],
                "authority": {
                    "holder": self.holder,
                    "holderSourceId": self.holder_source,
                    "epoch": self.epoch,
                },
            }
        return FakeResponse({"result": {"data": {"json": data}}})


class AuthorityDrillTests(unittest.TestCase):
    def test_drill_transfers_both_directions_and_passes(self):
        transport = DrillTransport()

        result = run_authority_drill(
            base_url="https://cloud.test",
            token="noc-secret",
            event_id="event-1",
            field_source_id="field-kit-01",
            operator_id="noc-operator-1",
            transport=transport,
        )

        self.assertEqual(result["status"], "pass")
        directions = [step["direction"] for step in result["steps"]]
        self.assertIn("field-to-cloud", directions)
        self.assertIn("cloud-to-field", directions)
        # field->cloud lands the cloud as holder at epoch 2, then cloud->field
        # returns authority to the kit at epoch 3.
        field_to_cloud = next(s for s in result["steps"] if s["direction"] == "field-to-cloud")
        cloud_to_field = next(s for s in result["steps"] if s["direction"] == "cloud-to-field")
        self.assertEqual(field_to_cloud["holder"], "cloud")
        self.assertEqual(field_to_cloud["epoch"], 2)
        self.assertEqual(cloud_to_field["holder"], "field")
        self.assertEqual(cloud_to_field["epoch"], 3)

    def test_drill_renders_printable_transcript(self):
        transport = DrillTransport()

        result = run_authority_drill(
            base_url="https://cloud.test",
            token="noc-secret",
            event_id="event-1",
            field_source_id="field-kit-01",
            operator_id="noc-operator-1",
            transport=transport,
        )

        self.assertIn("OMNIDAT AUTHORITY FAILOVER DRILL", result["transcript"])
        self.assertIn("FIELD-TO-CLOUD", result["transcript"])
        self.assertIn("CLOUD-TO-FIELD", result["transcript"])
        self.assertIn("RESULT: PASS", result["transcript"])


if __name__ == "__main__":
    unittest.main()
