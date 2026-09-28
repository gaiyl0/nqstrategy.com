export function validateLicenseConfig(env=process.env){
  const production=env.NODE_ENV==='production';
  const signingSecret=String(env.LICENSE_SIGNING_SECRET||'');
  const bindingSecret=String(env.LICENSE_BINDING_SECRET||'');
  if(production&&signingSecret.length<32)throw new Error('LICENSE_SIGNING_SECRET must contain at least 32 characters in production');
  if(production&&bindingSecret.length<32)throw new Error('LICENSE_BINDING_SECRET must contain at least 32 characters in production');
  if(signingSecret&&signingSecret.length<32)throw new Error('LICENSE_SIGNING_SECRET must contain at least 32 characters');
  if(bindingSecret&&bindingSecret.length<32)throw new Error('LICENSE_BINDING_SECRET must contain at least 32 characters');
  return {signingSecret:signingSecret||null,bindingSecret:bindingSecret||null};
}
if(process.env.NODE_ENV==='production')validateLicenseConfig(process.env);
