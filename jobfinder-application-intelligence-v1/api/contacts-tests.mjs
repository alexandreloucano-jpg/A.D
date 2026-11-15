import assert from 'node:assert/strict';
import {parsePublicSite,safeRedirect,robotsDisallowed,extractPublicContacts,publicIPv4,CONTACT_PATHS} from './contact-helpers.mjs';
let n=0;function t(name,fn){fn();n++;console.log('PASS',name)}
t('valid HTTPS public site',()=>assert.equal(parsePublicSite('https://www.example.com/some/path').href,'https://www.example.com/'));
for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://example.test','https://u:p@example.com','https://example.com:444'])t('unsafe site blocked: '+url,()=>assert.throws(()=>parsePublicSite(url)));
for(const ip of ['10.0.0.1','127.0.0.1','169.254.1.10','172.16.0.1','192.168.20.10','100.64.1.1','198.18.1.1','203.0.113.9'])t('private/test IP blocked: '+ip,()=>assert.equal(publicIPv4(ip),false));
t('public address accepted',()=>assert.equal(publicIPv4('8.8.8.8'),true));
t('www redirect accepted',()=>assert.equal(safeRedirect(new URL('https://example.com/'), 'https://www.example.com/contact').href,'https://www.example.com/contact'));
t('same-domain relative redirect accepted',()=>assert.equal(safeRedirect(new URL('https://example.com/'),'./fr/contact').href,'https://example.com/fr/contact'));
for(const url of ['https://evil.com/','http://example.com/', 'https://user@example.com','https://192.168.1.4/'])t('unsafe redirect blocked: '+url,()=>assert.throws(()=>safeRedirect(new URL('https://example.com/'),url)));
const robots=`User-agent: Googlebot\nDisallow: /contact\nUser-agent: *\nDisallow: /private\nDisallow: /jobs\nAllow: /jobs/public\nUser-agent: SandroJobFinder\nDisallow: /team\nAllow: /team/public`;
t('bot-specific robots disallows team',()=>assert.equal(robotsDisallowed(robots,'/team'),true));
t('bot-specific allow overrides',()=>assert.equal(robotsDisallowed(robots,'/team/public'),false));
t('bot-specific does not inherit other robots groups',()=>assert.equal(robotsDisallowed(robots,'/jobs'),false));
t('general robots disallows jobs',()=>assert.equal(robotsDisallowed('User-agent: *\nDisallow: /jobs','/jobs'),true));
t('general robots allows specific job page',()=>assert.equal(robotsDisallowed('User-agent: *\nDisallow: /jobs\nAllow: /jobs/public','/jobs/public/x'),false));
t('robots empty disallow ignored',()=>assert.equal(robotsDisallowed('User-agent: *\nDisallow:','/anything'),false));
const html=`<html><script>const poison='ghost@example.com'</script><style>.foo{content:'fake@example.com'}</style><p>Jobs team: careers@example.com</p><a href="mailto:hr@example.com">Join us</a><p>outside@gmail.com</p></html>`;
const contacts=extractPublicContacts(html,'https://example.com/careers',new URL('https://example.com/'));
t('visible email extracted',()=>assert.ok(contacts.some(c=>c.email==='careers@example.com')));
t('explicit mailto extracted',()=>assert.ok(contacts.some(c=>c.email==='hr@example.com')));
t('script email excluded',()=>assert.equal(contacts.some(c=>c.email==='ghost@example.com'),false));
t('style email excluded',()=>assert.equal(contacts.some(c=>c.email==='fake@example.com'),false));
t('personal nonofficial email excluded',()=>assert.equal(contacts.some(c=>c.email==='outside@gmail.com'),false));
t('extracted contact is published, not person verified',()=>assert.ok(contacts.every(c=>c.status==='published'&&!c.name)));
t('French paths supported',()=>assert.ok(CONTACT_PATHS.includes('/recrutement')&&CONTACT_PATHS.includes('/fr/contact')));
console.log(`${n}/${n} contact-source tests passed`)