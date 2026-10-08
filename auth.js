(() => {
  const URL = 'https://tojtsvnjbebdjxdtuhxq.supabase.co';
  const KEY = 'sb_publishable_9-80fso2pcykNvuWlCGJ3Q_JJeEJ2P5';
  let clientPromise = import('https://esm.sh/@supabase/supabase-js@2.117.3').then(({createClient}) => createClient(URL, KEY));
  const api = {
    get client(){ return clientPromise; },
    async session(){ const c=await clientPromise; return (await c.auth.getSession()).data.session; },
    async user(){ const c=await clientPromise; return (await c.auth.getUser()).data.user; },
    async signIn(email,password){ const c=await clientPromise; return c.auth.signInWithPassword({email,password}); },
    async signUp(email,password,username){ const c=await clientPromise; return c.auth.signUp({email,password,options:{data:{username}}}); },
    async signOut(){ const c=await clientPromise; return c.auth.signOut(); },
    async reset(email){ const c=await clientPromise; return c.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}); },
  };
  window.OWAuth=api;
})();
