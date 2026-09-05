import unittest
from extraction import map_fields, verify_form_codes


class ExtractionTests(unittest.TestCase):
    # Unknown handwriting remains a draft and signatures are never authenticated.
    def test_fields_and_signatures(self):
        result = map_fields([
            ("Complaint: Headache", 0.83),
            ("Patient guardian signature: Jane", 0.99),
        ], ["complaint", "temperature", "patient_guardian_signature"])
        self.assertEqual(result["fields"]["complaint"]["text"], "Headache")
        self.assertEqual(result["fields"]["temperature"]["confidence"], 0)
        self.assertEqual(result["fields"]["patient_guardian_signature"]["text"], "")

    # A different printed form cannot be silently imported into this encounter.
    def test_mismatched_form(self):
        with self.assertRaises(ValueError):
            verify_form_codes(["ZENTRAQ-FORM:other"], "expected")

    # Missing QR codes explicitly require manual identity verification.
    def test_missing_and_matching_codes(self):
        self.assertFalse(verify_form_codes([], "expected"))
        self.assertTrue(verify_form_codes(["ZENTRAQ-FORM:expected"], "expected"))


if __name__ == "__main__":
    unittest.main()
