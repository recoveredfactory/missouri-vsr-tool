export function GET() {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? "https://vsr.recoveredfactory.net";

  const js = `(function(){
  var BASE='${siteUrl}';
  class VsrChart extends HTMLElement{
    connectedCallback(){
      if(this.querySelector('iframe'))return;
      var lang=this.getAttribute('lang')||'en';
      var f=document.createElement('iframe');
      f.src=BASE+'/'+lang+'/embed/'+this.getAttribute('chart')+'/'+this.getAttribute('agency')+'/'+encodeURIComponent(this.getAttribute('metric')||'');
      f.style.cssText='width:100%;height:'+(this.getAttribute('height')||'420px')+';border:none;display:block';
      f.setAttribute('loading','lazy');
      f.title='Missouri Vehicle Stops chart';
      this.appendChild(f);
    }
  }
  if(!customElements.get('vsr-chart'))customElements.define('vsr-chart',VsrChart);
})();`;

  return new Response(js, {
    headers: { "content-type": "application/javascript; charset=utf-8" },
  });
}
