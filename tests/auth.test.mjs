import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedAuthOrigin, authMessage, safeReturnTo, validEmail, validPassword } from '../lib/auth/policy.ts';
import {profileDetails} from '../lib/auth/policy.ts';

test('registration profile validation bounds personal data and normalizes contact numbers',()=>{
  assert.deepEqual(profileDetails(' Test User ','+91 98765-43210'),{full_name:'Test User',contact_phone:'+919876543210'});
  for(const fields of [['A','9876543210'],['Test\nUser','9876543210'],['Test User','abc'],['Test User','123'],['Test User',''],['Test User',{}]]) assert.equal(profileDetails(...fields),null);
});

test('auth returns only to same-origin non-auth pages', () => {
  for (const value of [undefined, null, 1, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', '/auth/sign-out', '/a/../auth/callback?code=secret']) assert.equal(safeReturnTo(value), '/');
  assert.equal(safeReturnTo('/?view=bookings#next'), '/?view=bookings#next');
  assert.equal(safeReturnTo('/parking?city=Delhi'), '/parking?city=Delhi');
});

test('auth mutations require the canonical origin and reject cross-site writes', () => {
  assert.equal(allowedAuthOrigin('https://parksarthi.example','https://parksarthi.example','same-origin'), true);
  assert.equal(allowedAuthOrigin('https://evil.example','https://parksarthi.example','cross-site'), false);
  assert.equal(allowedAuthOrigin(null,'https://parksarthi.example',null), false);
  assert.equal(allowedAuthOrigin('https://parksarthi.example','https://parksarthi.example','cross-site'), false);
  assert.equal(allowedAuthOrigin('http://parksarthi.example','https://parksarthi.example','same-origin'), false);
});

test('account input validation bounds email and password before provider requests', () => {
  assert.equal(validEmail(' user@example.com '), 'user@example.com');
  for (const value of ['', 'x', 'a@b', 'a b@example.com', 'a'.repeat(255)+'@example.com', null]) assert.equal(validEmail(value), null);
  assert.equal(validPassword('long-enough-example'), true);
  for (const value of ['', 'short', 'x'.repeat(129), null, 123]) assert.equal(validPassword(value), false);
});

test('auth notices only render known safe message codes', () => {
  assert.match(authMessage('confirmation'), /inbox/);
  for (const value of ['constructor', '__proto__', 'toString', '<script>bad</script>', ['invalid'], undefined]) assert.equal(authMessage(value), null);
});

test('email codes reject malformed input before verification', async () => {
  const {validEmailCode} = await import('../lib/auth/policy.ts');
  assert.equal(validEmailCode('012345'), true);
  assert.equal(validEmailCode('0123456789'), true);
  for (const value of [null, 123456, '', '12345', '12345678901', '12 3456', '12345x', '123456\n', '<script>']) assert.equal(validEmailCode(value), false);
});
