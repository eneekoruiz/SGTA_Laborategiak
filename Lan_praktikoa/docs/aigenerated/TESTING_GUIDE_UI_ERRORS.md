# 🧪 TESTING GUIDE - UI ERROR SYNCHRONIZATION

## 🚀 Inicio Rápido

### 1. Inicia el Backend y Frontend

```bash
cd /Users/oihane/Desktop/SGTA_Laborategiak/Lan_praktikoa

# Terminal 1: Backend
cd backend && python3 -m app.main

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Base de datos (si es necesario)
docker run -d -p 27017:27017 mongo
```

### 2. Abre el navegador

```
http://localhost:5173  (o el puerto que indique npm)
```

---

## ✅ TEST CASES

### TEST 1: Email inválido en Login

**Objetivo**: Verificar que los errores del backend se muestran en rojo

**Pasos**:

1. Navega a `/login`
2. Ingresa:
   - Email: `wrong@` (inválido)
   - Password: `TestPass123`
3. Haz click en "Sartu"

**Resultado Esperado** ✅:

- ✅ Banner rojo aparece ENCIMA del formulario
- ✅ Mensaje: "Posta elektronikoa formatu okerra du" (o del backend)
- ✅ Campo email tiene borde rojo
- ✅ Ícono: ❌ (error)
- ✅ Botón cerrar (✕) en la esquina derecha

**Verificación en Consola** (F12 → Network):

```json
Response 400 o 422:
{
  "message": "Posta elektronikoa formatu okerra du",
  "error_type": "ValidationError",
  "fields": ["email"]
}
```

---

### TEST 2: Limpieza automática al escribir

**Objetivo**: Verificar que el error desaparece cuando el usuario escribe

**Pasos**:

1. Desde el estado anterior (con error visible)
2. Haz click en el campo Email
3. Escribe un carácter (ej: "x")

**Resultado Esperado** ✅:

- ✅ Banner rojo DESAPARECE inmediatamente
- ✅ Campo email vuelve a borde normal (gris)
- ✅ Si había error rojo en password, también se limpia
- ✅ Form vuelve a estado "limpio"

**Tipo de evento**: `on:input` (no on:change)

- on:input se dispara DURANTE la escritura
- on:change se dispara al perder el foco

---

### TEST 3: Email duplicado en Register

**Objetivo**: Verificar que errores complejos se muestran correctamente

**Pasos**:

1. Navega a `/register`
2. Ingresa datos:
   - Username: `testuser123`
   - Email: `admin@example.com` (que ya existe)
   - Password: `TestPass123`
   - Confirm Password: `TestPass123`
3. Haz click en "Erregistratu"

**Resultado Esperado** ✅:

- ✅ Banner NARANJA (warning level) aparece
- ✅ Mensaje: "Helbide elektronikoa jadanik erregistratuta dago"
- ✅ Campo email resaltado
- ✅ Ícono: ⚠️ (warning)
- ✅ Lista: "Eragengo eremuak: email"

**Verificación en Consola**:

```json
Response 400 o 409:
{
  "message": "Helbide elektronikoa jadanik erregistratuta dago",
  "error_type": "ConflictError",
  "fields": ["email"]
}
```

---

### TEST 4: Sesión expirada (401)

**Objetivo**: Verificar manejo de token expirado

**Pasos**:

1. Login exitoso (obtienes token JWT)
2. Abre DevTools → Application → LocalStorage
3. Edita el valor de `authToken` o `token` a algo invalido (ej: `invalid-token`)
4. Intenta cualquier acción (ej: navega a `/games` o intenta crear partida)

**Resultado Esperado** ✅:

- ✅ Backend responde 401
- ✅ localStorage se LIMPIA (token desaparece)
- ✅ Redirigido automáticamente a `/login`
- ✅ Banner rojo: "Zure saioa amaitu da okerreko token batengatik"
- ✅ Puedes hacer login de nuevo

**Verificación en Consola**:

```json
Response 401:
{
  "message": "Zure saioa amaitu da okerreko token batengatik"
}
```

---

### TEST 5: Múltiples errores simultáneos (Register)

**Objetivo**: Verificar que múltiples campos se muestran correctamente

**Pasos**:

1. Navega a `/register`
2. Ingresa datos INVÁLIDOS:
   - Username: `ab` (demasiado corto, mínimo 3)
   - Email: `notanemail` (sin @)
   - Password: `123` (demasiado corto)
   - Confirm Password: `456` (no coincide)
3. Haz click en "Erregistratu"

**Resultado Esperado** ✅:

- ✅ Banner con TODOS los errores agregados
- ✅ Cada campo relevante resaltado en rojo
- ✅ Si el backend maneja esto, mostrará lista de campos:
  ```
  Eragengo eremuak: username, email, password, confirmPassword
  ```

---

### TEST 6: Escribir en campo = Limpia TODO

**Objetivo**: Verificar que on:input limpia TODOS los errores

**Pasos**:

1. Desde el estado anterior (múltiples errores)
2. Haz click en CUALQUIER campo
3. Escribe un carácter

**Resultado Esperado** ✅:

- ✅ Banner DESAPARECE
- ✅ TODOS los campos vuelven a normal
- ✅ Errores específicos desaparecen
- ✅ Hint messages reaparecen (si existen)

---

### TEST 7: Dismissible Alert

**Objetivo**: Verificar que el botón cerrar funciona

**Pasos**:

1. Genera cualquier error (TEST 1, 3, o 5)
2. Haz click en botón ✕ (esquina derecha del banner)

**Resultado Esperado** ✅:

- ✅ Banner desaparece
- ✅ Puedes hacer submit de nuevo
- ✅ El error NO reaparece (fue manualmente cerrado)

---

## 🔍 VERIFICACIÓN DETALLADA

### En DevTools (F12)

#### Tab Network

1. Abre Network
2. Haz submit del formulario
3. Busca `POST /api/auth/login` o `POST /api/auth/register`
4. Haz click en la request
5. Abre tab "Response"

**Verificar**:

```json
✅ Campo "message" existe
✅ Mensaje está en Euskera
✅ Error_type es correcto (ValidationError, AuthError, etc)
✅ Fields array tiene nombres de campos
✅ Details dict tiene mensajes por campo
```

#### Tab Console

```javascript
// Cuando se dispara error:
console.log('Error capturado')
→ Debería mostrar el error enriquecido con:
  - message: string
  - statusCode: number
  - errorType: string
  - affectedFields: string[]
  - fieldMessages: object
```

#### Application → LocalStorage

**Después de 401**:

```
✅ "authToken" o "token" DEBE estar vacío
✅ NO debería tener valor residual
```

---

## 🎨 VALIDACIÓN VISUAL

### Error Level: ERROR ❌

- Background: #fee (rojo claro)
- Border izquierdo: #c33 (rojo)
- Ícono: ❌
- Ejemplo: Credenciales inválidas

### Error Level: WARNING ⚠️

- Background: #fef3cd (amarillo claro)
- Border izquierdo: #ff9800 (naranja)
- Ícono: ⚠️
- Ejemplo: Email ya existe, campo inválido

### Error Level: CRITICAL 🚨

- Background: #f8d7da (rosa)
- Border izquierdo: #721c24 (rojo oscuro)
- Ícono: 🚨
- Ejemplo: Error de servidor, conexión perdida

---

## 🐛 TROUBLESHOOTING

### Banner no aparece

**Posibles causas**:

- [ ] refresh no está limpiando el error
- [ ] Error object no está siendo enriquecido
- [ ] ErrorAlert component no se está renderizando

**Debug**:

```javascript
// En console, después de enviar formulario:
console.log("error var:", error);
console.log("affectedFields:", affectedFields);
```

### Error en inglés en lugar de Euskera

**Posibles causas**:

- [ ] Backend no está devolviendo mensaje en Euskera
- [ ] Frontend usando mensaje genérico de fallback

**Debug**:

- Mira Network → Response → field "message"
- Debe estar en Euskera

### Limpieza no funciona al escribir

**Posibles causas**:

- [ ] `on:input` no vinculado al input
- [ ] `handleInputChange()` no definido
- [ ] Svelte no está reactivizando

**Debug**:

```svelte
<input on:input={() => console.log('Input fired')} />
```

### Token no se limpia en 401

**Posibles causas**:

- [ ] `clearAuthToken()` no se llama
- [ ] localStorage key es diferente

**Debug**:

```javascript
// En LoginPage.svelte o legacy.ts:
if (response.status === 401) {
  console.log("401 detected");
  clearAuthToken();
  console.log("Token después:", localStorage.getItem("authToken"));
}
```

---

## ✨ CARACTERÍSTICAS ADICIONALES

### Animación de entrada

```
El banner entra con slideDown:
- 0ms: opacity 0, transform translateY(-10px)
- 300ms: opacity 1, transform translateY(0)
```

### Dark mode

Si el navegador tiene `prefers-color-scheme: dark`:

```
Error: background #3a1e1e, border #ff6b6b, text #ff8787
Warning: background #3a3208, border #ffa500, text #ffc107
Critical: background #3a1820, border #ff4757, text #ff6b7a
```

### Accesibilidad

```html
<div role="alert" aria-live="polite">
  <!-- El screen reader anuncia el error automáticamente -->
</div>

<button aria-label="Itxi alerta">✕</button>
<!-- El screen reader lee "Close alert" -->
```

---

## 📊 MATRIZ DE VALIDACIÓN FINAL

| Scenario        | Backend Status | Message Shown      | Visual      | Auto-Clear      | Result |
| --------------- | -------------- | ------------------ | ----------- | --------------- | ------ |
| Invalid email   | 400            | ✅ Campo message   | 🔴 Rojo     | ✅ on:input     | PASS   |
| Duplicate email | 409            | ✅ Campo message   | 🟠 Naranja  | ✅ on:input     | PASS   |
| Invalid token   | 401            | ✅ Euskera default | 🔴 Crítico  | ✅ localStorage | PASS   |
| Multiple errors | 422            | ✅ Agregado        | 🔴 Rojo     | ✅ on:input     | PASS   |
| Close button    | Any            | ✅ Desaparece      | -           | ✅ Manual       | PASS   |
| Dark mode       | Any            | ✅ Invertido       | 🎨 Correcto | ✅ on:input     | PASS   |

---

## 🎯 CHECKLIST FINAL

- [ ] Backend devuelve `message` en Euskera
- [ ] Frontend extrae campo `message` prioritariamente
- [ ] ErrorAlert component renderiza con color correcto
- [ ] Campos afectados se listan en el alert
- [ ] Campo rojo tiene borde y background rojo
- [ ] Error desaparece al escribir `on:input`
- [ ] Token se limpia en 401
- [ ] Redirige a /login en 401
- [ ] Botón ✕ funciona
- [ ] Dark mode funciona
- [ ] Animación slideDown visible
- [ ] Console no muestra warnings relevantes
- [ ] Build compila sin errores

---

**Última verificación**: Build exitoso ✅
**Status**: Ready for Acceptance Testing
