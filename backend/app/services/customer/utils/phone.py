# app/services/customer/utils/phone.py

def normalize_phone(phone: str | None) -> str | None:
    if phone is None:
        return None

    phone = (
        phone.strip()
        .replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
    )

    if not phone:
        return None

    if phone.startswith("03") and len(phone) == 11:
        return f"+92{phone[1:]}"

    if phone.startswith("923") and len(phone) == 12:
        return f"+{phone}"

    return phone