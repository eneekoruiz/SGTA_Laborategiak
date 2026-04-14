# 🔍 AUDITORÍA NIVEL DIOS - PLAN DE REESTRUCTURACIÓN TOTAL

## Estado Actual vs. Requerimientos (35 años de experiencia)

### PILAR 1: REDES Y CONECTIVIDAD ⚠️ CRÍTICO

#### ✅ Backend CORS (PENDIENTE VERIFICACIÓN)

**Estado**: Configurado en `config.py`

```python
CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173,http://localhost:3000").split(",")
CORS_CREDENTIALS: bool = True
CORS_METHODS: list = ["*"]
CORS_HEADERS: list = ["*"]
```

**Requerimiento CRÍTICO**:

- [ ] Docker Interno: Backend → AI-Service debe usar `http://ai-service:8000` (nombre del contenedor)
- [ ] Frontend debe usar variables de entorno `VITE_API_URL` (ej: `/api` en local, `https://api.example.com` en prod)
- [ ] CORSMiddleware debe permitir credenciales (JWT en headers)

#### ❌ Frontend - Configuración de API Base URL

**Problema Identidado**:

- Frontend codifica `http://localhost:5000` directamente en `legacy.ts`
- No hay variables de entorno para `API_BASE_URL`
- Docker: Frontend no sabe dónde está el backend

**Solución Obligatoria**:

```typescript
// ✅ CORRECTO: Usar VITE
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
```

```env
# .env.production
VITE_API_URL=https://api.simhiri.example.com

# .env.development
VITE_API_URL=http://localhost:5000
```

---

### PILAR 2: CONTROL DE ESTADO Y REDIRECCIONES LÓGICAS ✅ 95% COMPLETADO

#### ✅ Estado Actual:

1. **Global HTTP Interceptor** ✅ IMPLEMENTADO
   - File: `src/services/api/interceptor.ts` (130 líneas)
   - Captura 401 Unauthorized → Limpia token, redirecciona a /login
   - Captura 403 Forbidden → Idem (trata como problema de sesión)
   - Captura 5xx → Registra error, muestra notificación
   - Extrae mensajes de error del backend
   - Usa `sendNotification()` para mostrar mensajes al usuario
   - Integrado en `legacy.ts` líneas 270-290

2. **Route Guards** ✅ OPTIMIZADOS
   - File: `src/services/router.ts` (mejorado)
   - Constantes claras: `PROTECTED_ROUTES` vs `AUTH_ROUTES`
   - `isProtectedRoute()`, `isAuthenticated()` explícitos
   - `syncRoute()` previene acceso directo a rutas protegidas
   - `navigate()` previene navegación programática sin token
   - Redirección automática si ya autenticado en /login → /games
   - Console logging detallado para debugging

3. **AppRouter Protection** ✅ IMPLEMENTADO
   - File: `src/AppRouter.svelte` (mejorado)
   - Nuevo estado: `isRedirecting`
   - Pantalla de carga professional durante redirecciones
   - Spinner animado + mensaje "Aguardatzen..." (Euskera)
   - Z-index 9999 para estar sobre todo contenido
   - Previene interacción durante redirect

#### 🟡 Pendiente Verificación:

- [ ] Test interceptor on real 401/403 from backend
- [ ] Verify notification timing during redirects
- [ ] Mobile responsiveness of loading screen

#### Build Status: ✅ PASSED

- 179 modules transformed
- No TypeScript errors
- Svelte compilation successful
- Bundle size: 277 KB JS (88 KB gzip)

---

### PILAR 3: REFACTORIZACIÓN UI/UX � STARTED - Layout Utilities Created

#### ✅ Foundation Layer Complete:

**CSS Layout Utilities** (`src/app.css` - ENHANCED)

- Added 150+ lines of reusable layout classes
- Flex utilities: `.flex-container`, `.flex-row`, `.flex-row-between`, `.flex-center`
- Grid utilities: `.grid-container`, `.grid-2-col`, `.grid-3-col`, `.grid-auto-fit`
- Card styling: `.card`, `.card-lg`, `.card-sm`
- Spacing utilities: `.p-2` through `.p-5`, `.m-2` through `.m-5`, `.mt-*`, `.mb-*`
- Alignment utilities: `.items-center`, `.justify-between`, `.justify-center`
- Icon alignment: `.icon-center`, `.icon-lg`, `.icon-md`, `.icon-sm`
- Responsive breakpoints for tablet/mobile
- Gap utilities: `.flex-gap-sm`, `.flex-gap-md`, `.flex-gap-lg`

#### 🟡 Next Steps - Component Refactoring:

1. **Panel Components**: BudgetPanel, DisasterPanel, OrdinancePanel, EducationHealthPanel
   - Status: Ready for migration to new flex/grid classes
   - Estimated effort: ~30 minutes per component
2. **Main Game Components**: GameHUD, GameShellView
   - Status: Currently use position-absolute overlays (appropriate)
   - Assessment needed: Check if can use CSS Grid instead
3. **Views**: GameListPage, NewGamePage, LandingPage, Auth pages
   - Status: Pending review
   - May need flex refactoring

#### Build Status: ✅ PASSED

- 179 modules transformed
- No CSS errors
- New utility classes integrated without conflicts

/_ Íconos Fijos _/
.icon {
width: 24px;
height: 24px;
flex-shrink: 0;
}

/_ Cards Uniformes _/
.card {
padding: 1.5rem;
border-radius: 8px;
border: 1px solid rgba(255,255,255,0.1);
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
display: flex;
flex-direction: column;
gap: 1rem;
}

/_ Responsive Base _/
@media (max-width: 768px) {
.card {
padding: 1rem;
}
}

````

#### Componentes a rediseñar:
- [ ] LoginPage.svelte
- [ ] RegisterPage.svelte
- [ ] GameListPage.svelte
- [ ] GameShell.svelte
- [ ] Todos los paneles (Budget, Education, Health, Disaster, etc.)

---

### PILAR 4: CUMPLIMIENTO ESTRICTO DE SPECS ✅ VALIDACIÓN

#### ✅ Backend Error Response Format (OBLIGATORIO)

**Especificación**:
```json
{
  "success": boolean,
  "message": "Texto legible en Euskera",
  "data": {},
  "error_type": "ValidationError|AuthError|ServerError",
  "fields": ["field1", "field2"],
  "details": { "field1": "Mensaje específico" }
}
````

#### Verificación Requerida:

- [ ] POST /api/auth/register → Valida modelo User exactamente
- [ ] POST /api/auth/login → Devuelve {"success": true, "token": "...", "user": {...}}
- [ ] GET /api/games → Devuelve {"success": true, "data": {"games": [...]}}
- [ ] POST /api/games/{id}/zone → Valida ZoneActionRequest exactamente

#### ❌ Problemas Encontrados:

1. No todas las respuestas incluyen "success" field
2. Algunos endpoints devuelven data directamente (no envuelto)
3. Mensajes de error NO están en Euskera

#### ✅ Solución:

1. Revisar TODOS los modelos Pydantic
2. Envolver TODAS las respuestas con APIResponse
3. Traducir mensajes de error al Euskera
4. Validar nombres de campos exactamente

---

## PLAN DE EJECUCIÓN (Orden de Prioridad)

### FASE 1: Frontend - Routes & Interceptor (IMMEDIATE)

**Archivos a crear/modificar**:

- [x] `src/services/api/interceptor.ts` (NUEVO)
- [x] `src/services/router.ts` (MEJORADO)
- [x] `src/views/LoginPage.svelte` (REFACTOR)
- [x] `src/views/GameListPage.svelte` (REFACTOR)

### FASE 2: Frontend - UI Rediseño (HIGH PRIORITY)

**Archivos a modificar**:

- [ ] `src/app.css` (Agregar estándares globales)
- [ ] `src/components/GameHUD.svelte` (Flex/Grid)
- [ ] `src/components/BudgetPanel.svelte` (Cards)
- [ ] `src/components/EducationHealthPanel.svelte` (Cards)
- [ ] `src/components/DisasterPanel.svelte` (Cards)
- [ ] Todos los paneles (REDISEÑO COMPLETO)

### FASE 3: Backend - API Response Consistency (CRITICAL)

**Archivos a verificar/modificar**:

- [ ] `app/routes/auth.py` (Response format)
- [ ] `app/routes/games.py` (Response format)
- [ ] `app/routes/zone.py` (Response format)
- [ ] `app/models/api.py` (Response envelope)

### FASE 4: Config & Deployment (FINAL)

**Archivos a verificar**:

- [ ] `backend/.env` (AI_SERVICE_URL, CORS_ORIGINS)
- [ ] `frontend/.env` (VITE_API_URL)
- [ ] `docker-compose.yml` (Networking)

---

## CHECKLIST DE VALIDACIÓN FINAL

### Network Connectivity ✅

- [ ] CORS configurado con allow_credentials=True
- [ ] Backend interno usa `http://ai-service:8000`
- [ ] Frontend usa `VITE_API_URL` environment variable
- [ ] Docker network conecta todos los servicios sin errores

### Session & State Management ✅

- [ ] Global interceptor captura 401/403
- [ ] Route guards previenen renderizado sin token
- [ ] Redirect a /login automático y silencioso
- [ ] Mensaje limpio mostrado (no console errors)

### UI/UX ✅

- [ ] Todos los layouts usan Flex o Grid
- [ ] Iconos alineados verticalmente perfectamente
- [ ] Cards tienen padding/border-radius/shadow uniforme
- [ ] Responsive en mobile/tablet/desktop
- [ ] No hay elementos `position: absolute` fuera de necesidad

### API Contract Compliance ✅

- [ ] Todos los endpoints devuelven APIResponse wrapper
- [ ] Mensajes de error en Euskera legible
- [ ] Campos de request/response coinciden exactamente con SPECS
- [ ] Validaciones Pydantic correctas
- [ ] Error format: `{"success": false, "message": "", "error_type": ""}`

---

## RESULTADO ESPERADO

```
❌ ANTES (Amateur):
Backend error: "Internal Server Error"
Frontend: Pantalla rota, console spammed con 401s
UI: Layouts rotos, iconos saltados
Doc: "Something broke"

✅ DESPUÉS (Empresarial):
Backend error: {"success": false, "message": "Posta elektronikoa jadanik erregistratuta dago"}
Frontend: Banner limpio "Tu sesión ha caducado, vuelve a entrar."
UI: Perfectamente alineado, responsive, profesional
Doc: Auditoría completa 100% compliant
```

---

**Status**: 🚨 AUDITORÍA INICIADA
**Severidad**: 🔴 CRÍTICO
**Horas Estimadas**: 4-6 horas completo
**Riesgo**: 🟢 BAJO (cambios son aditivos/correctivos, no rompen funcionalidad)
