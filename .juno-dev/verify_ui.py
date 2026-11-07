from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--autoplay-policy=no-user-gesture-required'])
 page=b.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8785/')
 text=page.locator('body').inner_text()
 assert 'Edit by Juno' in text and '오리지널 버전 (패치 미적용)' in text
 assert all(s not in text for s in ['어떤 버전으로 항해할까요?','STABILITY FIX 1','기존 버전 (변경 없음)'])
 assert page.locator('[data-game]').count()==9
 assert all('A' not in s for s in page.locator('.primary').all_text_contents())
 assert not page.locator('#disableSeaEventsEnabled').is_checked()
 page.evaluate("document.getElementById('optionsBtn').click()")
 assert page.locator('#soundVolume').is_visible()
 assert not page.locator('#strongLuckEnabled').is_visible()
 page.evaluate('window.testAudio = new AudioContext()')
 page.locator('#soundVolume').fill('0');page.wait_for_timeout(250)
 assert page.evaluate('testAudio.masterVolume.gain.value')<0.001
 page.locator('#soundVolume').fill('35');page.wait_for_timeout(250)
 assert abs(page.evaluate('testAudio.masterVolume.gain.value')-.35)<.001
 page.reload();page.evaluate("document.getElementById('optionsBtn').click()");assert page.locator('#soundVolume').input_value()=='35'
 page.locator('#closeOptionsBtn').click()
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path='.juno-dev/start-mobile.png',full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert errors==[],errors
 b.close()
print('Start screen, nine versions, sea-checkbox default, audio gain/mute/persistence and mobile layout passed')
