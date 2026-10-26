from enum import StrEnum


class LedgerEntryType(StrEnum):
    UDHAAR = "UDHAAR"
    SUPPLY = "SUPPLY"
    PAYMENT = "PAYMENT"