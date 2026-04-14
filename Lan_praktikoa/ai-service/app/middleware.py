"""Logging middleware para auditoría de solicitudes y respuestas en AI-Service."""
import logging
import time
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Configurar logger
logger = logging.getLogger("simhiri.ai.audit")

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware que registra todas las solicitudes y respuestas con formato legible."""

    async def dispatch(self, request: Request, call_next):
        # Capturar información de solicitud
        method = request.method
        path = request.url.path
        query_string = request.url.query if request.url.query else ""
        
        # Capturar el cuerpo de la solicitud (para métodos que lo tienen)
        body = ""
        if method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                if body_bytes:
                    body = body_bytes.decode("utf-8")
                    # Intentar parsear como JSON para mejor legibilidad
                    try:
                        body = json.dumps(json.loads(body), indent=2)
                    except:
                        pass
            except:
                body = "<could not read body>"
        
        # Log de solicitud
        url_display = f"{path}?{query_string}" if query_string else path
        logger.info(f"[REQUEST] {method} {url_display}")
        if body:
            # Limitar el tamaño del log
            if len(body) > 500:
                logger.debug(f"  BODY: {body[:500]}...")
            else:
                logger.debug(f"  BODY: {body}")

        # Procesar la solicitud y medir tiempo
        start_time = time.time()
        try:
            response = await call_next(request)
            elapsed_time = time.time() - start_time
            status_code = response.status_code
            
            # Log de respuesta exitosa
            logger.info(f"[RESPONSE] {status_code} - {elapsed_time:.3f}s")
            
            return response
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(
                f"[RESPONSE] 500 ERROR - {elapsed_time:.3f}s - {str(e)}"
            )
            raise


def setup_logging():
    """Configurar logging a nivel DEBUG con formato legible."""
    # Crear logger raíz con nivel DEBUG
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Si no hay handlers, crear uno para consola
    if not root_logger.handlers:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        
        # Formato con timestamp y nivel
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # Configurar el logger de auditoría específico
    audit_logger = logging.getLogger("simhiri.ai.audit")
    audit_logger.setLevel(logging.DEBUG)
