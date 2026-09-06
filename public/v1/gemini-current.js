/* Miracolo Lab V1 — Gemini compatibility bridge. */
(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    let url='';
    if(typeof input==='string') url=input;
    else if(input instanceof Request) url=input.url;
    if(url.includes('/models/gemini-1.5-flash:')){
      url=url.replace('/models/gemini-1.5-flash:','/models/gemini-2.5-flash:');
      if(typeof input==='string') return nativeFetch(url,init);
      return nativeFetch(new Request(url,input),init);
    }
    return nativeFetch(input,init);
  };
})();
