"""Map Pydantic validation errors to human-readable messages in Basque/Spanish."""
from typing import Dict, List, Any, Tuple


# Pydantic error type → Human readable message template
ERROR_MESSAGE_MAP = {
    "string_type": "Balioa testu bat izan behar du",
    "string_too_short": "Balioa gutsienez {min_length} karaktere izan behar du",
    "string_too_long": "Balioa gehienez {max_length} karaktere izan behar du",
    "string_pattern": "Balioak formatua ez du betetzen",
    "value_error": "Balioaren formatu okerra",
    "email": "Posta elektroniko-a okerrekoa da",
    "int_type": "Balioa zenbaki osoa izan behar du",
    "float_type": "Balioa zenbaki bat izan behar du",
    "bool_type": "Balioa boolearra izan behar du",
    "missing": "Balioa derrigorrezkoa da",
    "extra_fields": "Ez dago inongo balioa horrentzako",
}

# Custom validation messages by field name
FIELD_SPECIFIC_MESSAGES = {
    "username": {
        "string_pattern": "Erabiltzaile-izenak 3-30 karaktere izan behar ditu eta letrak, zenbakiak edo azpimarrak soilik eduki.",
        "string_too_short": "Erabiltzaile-izenak gutxienez 3 karaktere izan behar du",
        "string_too_long": "Erabiltzaile-izenak gehienez 30 karaktere izan behar du",
    },
    "email": {
        "email": "Sartu baliozko posta elektroniko bat (adibidez: user@example.com)",
        "missing": "Posta elektroniko-a derrigorrezkoa da",
    },
    "password": {
        "string_too_short": "Pasahitza gutxienez 8 karaktere izan behar du eta letra + zenbaki eduki",
        "missing": "Pasahitza derrigorrezkoa da",
    },
    "confirm_password": {
        "missing": "Pasahitza berretsi derrigorrezkoa da",
    },
}


def get_error_message(field: str, error_type: str, ctx: Dict[str, Any]) -> str:
    """
    Extract human-readable error message from Pydantic error.
    
    Args:
        field: Field name where error occurred
        error_type: Error type string from Pydantic
        ctx: Context dict with validation details
    
    Returns:
        Human-readable error message in Basque
    """
    # Try field-specific message first
    if field in FIELD_SPECIFIC_MESSAGES:
        if error_type in FIELD_SPECIFIC_MESSAGES[field]:
            return FIELD_SPECIFIC_MESSAGES[field][error_type]
    
    # Try generic error message
    if error_type in ERROR_MESSAGE_MAP:
        message = ERROR_MESSAGE_MAP[error_type]
        # Replace placeholders with context values
        if "min_length" in message and "min_length" in ctx:
            message = message.format(min_length=ctx["min_length"])
        if "max_length" in message and "max_length" in ctx:
            message = message.format(max_length=ctx["max_length"])
        return message
    
    # Fallback
    return f"Balioaren errore: {error_type}"


def parse_validation_errors(errors: List[Dict[str, Any]]) -> Tuple[str, List[str], Dict[str, str]]:
    """
    Parse Pydantic validation errors and return:
    - Single aggregated message for user
    - List of affected field names
    - Dict mapping fields to specific messages
    
    Args:
        errors: List of Pydantic validation errors
    
    Returns:
        (aggregated_message, affected_fields, field_messages)
    """
    affected_fields = []
    field_messages = {}
    messages = []
    
    for error in errors:
        # Extract field name from location tuple
        field_path = error.get("loc", [])
        field_name = field_path[0] if field_path else "unknown"
        
        # Skip non-field errors
        if field_name == "body" and len(field_path) > 1:
            field_name = field_path[1]
        
        if field_name not in affected_fields:
            affected_fields.append(str(field_name))
        
        # Get error message
        error_type = error.get("type", "value_error")
        ctx = error.get("ctx", {})
        
        msg = get_error_message(str(field_name), error_type, ctx)
        
        # Store field-specific message
        if str(field_name) not in field_messages:
            field_messages[str(field_name)] = msg
        
        # Add to aggregated messages
        if msg not in messages:
            messages.append(msg)
    
    # Create aggregated message
    if len(messages) == 1:
        aggregated = messages[0]
    elif len(messages) > 1:
        aggregated = " Gainera, " .join(messages)
    else:
        aggregated = "Balioaren errore ez zehaztua"
    
    return aggregated, affected_fields, field_messages


def format_error_response(
    message: str,
    error_type: str = "ValidationError",
    fields: List[str] = None,
    details: Dict[str, str] = None
) -> Dict[str, Any]:
    """
    Format error response in standard structure.
    
    Args:
        message: Human-readable error message
        error_type: Type of error (ValidationError, AuthError, etc.)
        fields: List of affected field names
        details: Additional details dict
    
    Returns:
        Formatted error response dict
    """
    return {
        "success": False,
        "message": message,
        "error_type": error_type,
        "fields": fields or [],
        "details": details or {},
        "data": None,
    }
