import { Api } from './api';

import { environment } from '../environments/environment';
const originalBaseUrl = environment.apiBaseUrl;

describe('API deployment connection', () => {
  beforeEach(() => { environment.apiBaseUrl = 'https://reserva.api.atenix.net/api/v1'; });
  afterEach(() => { environment.apiBaseUrl = originalBaseUrl; vi.unstubAllGlobals(); });
  it('sends requests and session credentials to the configured API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'UP' })));
    vi.stubGlobal('fetch', fetchMock);
    await new Api().request('/health');
    expect(fetchMock).toHaveBeenCalledWith('https://reserva.api.atenix.net/api/v1/health',
      expect.objectContaining({ credentials: 'include' }));
  });
  it('keeps CSRF protection when logging in across origins', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'test-csrf' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '1' })));
    vi.stubGlobal('fetch', fetchMock);
    await new Api().request('/auth/login', 'POST', { username: 'test', password: 'test' });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://reserva.api.atenix.net/api/v1/auth/csrf',
      expect.objectContaining({ credentials: 'include' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://reserva.api.atenix.net/api/v1/auth/login',
      expect.objectContaining({ credentials: 'include', headers: expect.objectContaining({ 'X-CSRF-TOKEN': 'test-csrf' }) }));
  });
});
