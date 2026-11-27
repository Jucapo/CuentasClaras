import { InvitationLinkParams, parseInvitationLink } from './invitation-link';

const TOKEN = 'ab'.repeat(32);
const ID = '478a6f7e-7647-4464-a589-de139c208303';
const NONE: InvitationLinkParams = { token: null, tokenHash: null, type: null, id: null };

describe('parseInvitationLink', () => {
  it('reads the email link to a new account', () => {
    expect(
      parseInvitationLink({ ...NONE, token: TOKEN, tokenHash: 'e12afa6d', type: 'invite' }),
    ).toEqual({ kind: 'email', token: TOKEN, tokenHash: 'e12afa6d' });
  });

  it('treats a token without the Auth hash as a copied link', () => {
    expect(parseInvitationLink({ ...NONE, token: TOKEN })).toEqual({ kind: 'link', token: TOKEN });
    expect(parseInvitationLink({ ...NONE, token: TOKEN, tokenHash: 'x', type: 'recovery' })).toEqual(
      { kind: 'link', token: TOKEN },
    );
  });

  it('reads the in-app notice by id', () => {
    expect(parseInvitationLink({ ...NONE, id: ID.toUpperCase() })).toEqual({
      kind: 'app',
      invitationId: ID,
    });
  });

  it('prefers the token over the id', () => {
    expect(parseInvitationLink({ ...NONE, token: TOKEN, id: ID }).kind).toBe('link');
  });

  it('rejects malformed or missing params', () => {
    expect(parseInvitationLink(NONE)).toEqual({ kind: 'invalid' });
    expect(parseInvitationLink({ ...NONE, token: 'corto' })).toEqual({ kind: 'invalid' });
    expect(parseInvitationLink({ ...NONE, token: 'corto', id: ID })).toEqual({ kind: 'invalid' });
    expect(parseInvitationLink({ ...NONE, id: 'no-es-un-id' })).toEqual({ kind: 'invalid' });
  });
});
