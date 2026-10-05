# app/models/enums/ledger_entry_type.py
from enum import StrEnum


class LedgerEntryType(StrEnum):
    UDHAAR = "UDHAAR"
    PAYMENT = "PAYMENT"