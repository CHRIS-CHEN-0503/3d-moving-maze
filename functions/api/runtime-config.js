// Technical configuration is edited in deployment variables, never through the player UI.
export function onRequestGet({env}) {
  const valid=(value,protocol,fallback)=>{try{const u=new URL(value);return protocol.includes(u.protocol)&&!u.username&&!u.password?u.href:fallback;}catch{return fallback;}};
  return Response.json({
    broker:valid(env.MAZE_BROKER_URL,['wss:'],'wss://broker.emqx.io:8084/mqtt'),
    apiUrl:valid(env.MAZE_SCORES_URL,['https:'],'')
  },{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
