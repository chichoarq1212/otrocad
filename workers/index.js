/* OtroCAD unified static site + protected online El Arqui API.
 * Static content is served directly by Workers assets; only /api/* executes this Worker.
 */
import arqui from './arqui-ai.js';
export default {
 async fetch(request, env, ctx) {
  const {pathname}=new URL(request.url);
  if(pathname==='/api/arqui'||pathname==='/api/arqui/status')return arqui.fetch(request,env,ctx);
  if(pathname.startsWith('/api/'))return new Response('No encontrado',{status:404});
  return env.ASSETS.fetch(request);
 }
};
