# 🚀 GUÍA RÁPIDA - Sistema de Manejo de Errores

## ¿Cómo funciona?

### 1️⃣ Usuario intenta login/register

```
Email: bademail.com
Password: 123
```

### 2️⃣ Backend valida

Pydantic rechaza con errores de validación

### 3️⃣ Backend mapea a mensaje legible (Euskera)

```json
{
  "success": false,
  "error_type": "ValidationError",
  "message": "Posta elektroniko okerra eta pasahitza gutxienez 8 karaktere",
  "fields": ["email", "password"],
  "details": {
    "email": "Sartu baliozko posta elektroniko bat",
    "password": "Pasahitza gutxienez 8 karaktere izan behar du eta letra + zenbaki eduki"
  }
}
```

### 4️⃣ Frontend procesa error

- Extrae affectedFields = ["email", "password"]
- Extrae fieldMessages
- Pasa a componentes Form

### 5️⃣ UI muestra error

- ErrorAlert rojo en top (mensaje general)
- Input email resaltado en rojo
- Input password resaltado en rojo
- Mensaje específico debajo de cada input

---

## 📝 Para Desarrolladores

### Agregar nueva validación al Backend

**Arquivo**: `backend/app/utils/error_mapping.py`

```python
FIELD_SPECIFIC_MESSAGES = {
    "nuevo_campo": {
        "error_type": "Mensaje en euskera",
    },
}
```

### Mejorar mensajes de error traducidos

**Archivo**: `backend/app/utils/error_mapping.py`

Bajo sección de `ERROR_MESSAGE_MAP` y `FIELD_SPECIFIC_MESSAGES`

### Personalizar estilos de ErrorAlert

**Archivo**: `frontend/src/components/ErrorAlert.svelte`

Sección `<style>`:

```svelte
.alert--error {
  background-color: #fee;    /* Fondo rojo claro */
  border-left-color: #c33;   /* Borde rojo */
  color: #a00;               /* Texto rojo oscuro */
}
```

### Agregar nuevo formulario con errores

**Patrón**:

```svelte
<script>
  import { createFormErrorStore, applyApiErrorsToForm } from '../../store/formErrors'
  import ErrorAlert from '../../components/ErrorAlert.svelte'
  import FormField from '../../components/FormField.svelte'

  const formErrors = createFormErrorStore()
  let affectedFields = []
  let error = ''

  async function handleSubmit() {
    error = ''
    formErrors.clearAll()

    try {
      await api.call()
    } catch (err) {
      const errorFields = (err as any)?.affectedFields || []
      const fieldMessages = (err as any)?.fieldMessages || {}

      if (errorFields.length > 0) {
        applyApiErrorsToForm(formErrors, errorFields, fieldMessages)
        affectedFields = errorFields
      }

      error = err instanceof Error ? err.message : 'Error texto defektua'
    }
  }
</script>

<ErrorAlert {error} {affectedFields} onDismiss={...} />

<FormField name="field1" error={$formErrors.field1 || ''}>
  <input bind:value={field1} />
</FormField>
```

---

## 🔍 Debugging

### Ver logs completos de error en consola

```typescript
// Abrir Developer Tools (F12)
// Ir a Console tab
// Los errores aparecen con formato:

[API Error] /api/auth/login: {
  error: Error object,
  statusCode: 422,
  errorType: "ValidationError",
  affectedFields: ["email"],
  fieldMessages: { email: "..." },
  message: "..."
}
```

### Probar respuesta de error en curl

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "a",
    "email": "invalid",
    "password": "short"
  }'

# Respuesta:
{
  "success": false,
  "error_type": "ValidationError",
  "message": "...",
  "fields": [...],
  "details": {...}
}
```

---

## 🐛 Troubleshooting

### Error no aparece en formulario

**Causa**: Backend no retorna `error_type`
**Solución**: Verificar que main.py tenga todos los handlers

### Input no se resalta en rojo

**Causa**: CSS no aplicado
**Solución**: Verificar clase `has-error` en FormField.svelte

### Mensaje en inglés en lugar de Euskera

**Causa**: Backend sin traducción de error
**Solución**: Agregar mapeo en `error_mapping.py`

### El error desaparece demasiado rápido

**Causa**: AlertError tiene duración corta por defecto
**Solución**: Cambiar `onApiSuccess()` timeout o hacer dismissible

---

## 📊 Status de Tests

```bash
python3 test_error_handling.py

✅ TEST 1: Validation Error (422) - PASS
✅ TEST 2: Auth Error (401) - PASS
✅ TEST 3: Successful Registration - PASS
✅ TEST 4: Field-Specific Errors - PASS

Total: 4/4 PASSED ✅
```

---

## 💡 Tips

1. **Siempre usar FormField** para inputs en formularios - proporciona resaltado consistente
2. **Limpiar errores** al hacer click en input (`formErrors.clearError(field)`)
3. **Persistir errores** hasta que usuario intente de nuevo (no auto-desaparecer)
4. **Usar level="warning"** para 422 (validación), **level="error"** para fallos lógica, **level="critical"** para 5xx

---

## 🔗 Enlaces

- Documentación completa: `ERROR_HANDLING_IMPLEMENTATION.md`
- Backend error mapping: `backend/app/utils/error_mapping.py`
- Test suite: `test_error_handling.py`
- Component examples: `frontend/src/components/ErrorAlert.svelte`
