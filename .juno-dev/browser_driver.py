import json, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
p=sync_playwright().start()
b=p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required'])
c=b.new_context(viewport={'width':1280,'height':960})
page=c.new_page()
page.on('pageerror',lambda e: print('PAGEERROR '+str(e),flush=True))
page.goto('http://127.0.0.1:8785/')
page.evaluate('''() => {
  const original=UW2Enhancements.connect;
  UW2Enhancements.connect=(em)=>{window.testEm=em;window.testAPI=original(em);return window.testAPI;};
}''')
print('READY',flush=True)
for line in sys.stdin:
 try:
  req=json.loads(line)
  if req['action']=='eval': result=page.evaluate(req['code'])
  elif req['action']=='click': page.locator(req['selector']).click(); result='clicked'
  elif req['action']=='key': page.keyboard.press(req['key']); result='pressed'
  elif req['action']=='shot': page.screenshot(path=req['path']); result='saved'
  elif req['action']=='wait': page.wait_for_timeout(req['ms']); result='waited'
  elif req['action']=='quit': break
  print(json.dumps(result,ensure_ascii=False),flush=True)
 except Exception as e: print('ERROR '+str(e),flush=True)
b.close();p.stop()
