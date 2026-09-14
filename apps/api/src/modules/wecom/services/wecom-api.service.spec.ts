import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WecomApiService } from './wecom-api.service';

function createService() {
  // Redis 静默降级（与 spike 脚本一致）
  return new WecomApiService(null as any);
}

describe('WecomApiService 客户联系域', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });
  afterEach(() => vi.restoreAllMocks());

  it('getMemberByCode：GET /auth/getuserinfo 返回 userid', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0, userid: 'zhangsan' }) });
    const res = await createService().getMemberByCode('tk', 'CODE123');
    expect(res).toEqual({ userId: 'zhangsan', openId: undefined, errcode: 0 });
    expect(fetchMock.mock.calls[0][0]).toContain('auth/getuserinfo');
  });

  it('getMemberByCode：非成员（仅 openid）返回空 userId', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0, openid: 'oXXXX' }) });
    const res = await createService().getMemberByCode('tk', 'CODE');
    expect(res.userId).toBeUndefined();
  });

  it('getExternalContact：解析 external_contact', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ errcode: 0, external_contact: { name: '王女士', avatar: 'https://x' } }),
    });
    const data = await createService().getExternalContact('tk', 'wmX');
    expect(data.external_contact.name).toBe('王女士');
    expect(fetchMock.mock.calls[0][0]).toContain('externalcontact/get');
  });

  it('markTags：POST mark_tag，body 含 add_tag', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0 }) });
    await createService().markTags('tk', { externalUserId: 'wmX', addTag: ['tag1'] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('externalcontact/mark_tag');
    expect(JSON.parse(init.body)).toEqual({ userid: 'wmX', add_tag: ['tag1'] });
  });

  it('addContactWay：POST add_contact_way', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0, config_id: 'cfg1' }) });
    const res = await createService().addContactWay('tk', { type: 2, scene: 2, state: 'lc_x' });
    expect(res.config_id).toBe('cfg1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('externalcontact/add_contact_way');
    expect(JSON.parse(init.body)).toMatchObject({ type: 2, scene: 2, state: 'lc_x' });
  });

  it('delContactWay：POST del_contact_way', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0 }) });
    await createService().delContactWay('tk', 'cfg1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('externalcontact/del_contact_way');
    expect(JSON.parse(init.body)).toEqual({ config_id: 'cfg1' });
  });

  it('getJsapiTicket：返回 ticket', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ errcode: 0, ticket: 'TKT12345' }) });
    const res = await createService().getJsapiTicket('tk');
    expect(res).toBe('TKT12345');
  });

  it('errcode ≠0 时抛错并带 errcode 信息', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ errcode: 48001, errmsg: 'api forbidden' }),
    });
    await expect(createService().getExternalContact('tk', 'wmX')).rejects.toThrow(/48001/);
  });
});
