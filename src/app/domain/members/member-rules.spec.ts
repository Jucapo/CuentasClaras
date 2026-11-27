import { canChangeRole, canLeave, canRemove, MemberRef, ownerCount } from './member-rules';

const ANA: MemberRef = { userId: 'ana', role: 'owner' };
const BETO: MemberRef = { userId: 'beto', role: 'editor' };
const DANI: MemberRef = { userId: 'dani', role: 'viewer' };

describe('member rules', () => {
  it('lets an owner change and remove the other members, not themselves', () => {
    expect(canChangeRole(ANA, BETO)).toBe(true);
    expect(canRemove(ANA, DANI)).toBe(true);
    expect(canChangeRole(ANA, ANA)).toBe(false);
    expect(canRemove(ANA, ANA)).toBe(false);
  });

  it('lets an owner change another owner', () => {
    expect(canChangeRole(ANA, { userId: 'beto', role: 'owner' })).toBe(true);
  });

  it('never lets editors, viewers or nobody manage members', () => {
    expect(canChangeRole(BETO, DANI)).toBe(false);
    expect(canRemove(DANI, BETO)).toBe(false);
    expect(canChangeRole(null, DANI)).toBe(false);
  });

  it('counts owners', () => {
    expect(ownerCount([ANA, BETO, DANI])).toBe(1);
    expect(ownerCount([ANA, { ...BETO, role: 'owner' }])).toBe(2);
  });

  it('lets anyone leave except the last owner', () => {
    expect(canLeave([ANA, BETO, DANI], 'beto')).toBe(true);
    expect(canLeave([ANA, BETO, DANI], 'dani')).toBe(true);
    expect(canLeave([ANA, BETO], 'ana')).toBe(false);
    expect(canLeave([ANA, { ...BETO, role: 'owner' }], 'ana')).toBe(true);
    expect(canLeave([ANA], 'ana')).toBe(false);
    expect(canLeave([ANA, BETO], 'caro')).toBe(false);
  });
});
