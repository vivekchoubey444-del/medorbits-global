# API integration

`src/api-client.js` provides a small fetch-based client. Example:

```js
import { createApiClient } from './src/api-client.js';

const api = createApiClient({
  getToken: async () => null // Connect to an approved secure session provider.
});
const courses = await api.get('/courses');
```

Adjust paths and response handling to match the actual MedOrbits API contract.
The client sends cookies by default (`credentials: include`) and can add a bearer
token through `getToken`; configure backend CORS, cookie SameSite/Secure settings,
CSRF protection and session expiry accordingly.
