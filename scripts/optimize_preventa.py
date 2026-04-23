import re

html_path = 'web/preventa.html'
with open(html_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extract CSS
style_match = re.search(r'<style>([\s\S]*?)</style>', text)
if style_match:
    css_content = style_match.group(1).strip()
    with open('web/css/preventa.css', 'w', encoding='utf-8') as f:
        f.write(css_content)
    text = text.replace(style_match.group(0), '<link rel="stylesheet" href="/css/preventa.css">')
    print('CSS extracted to web/css/preventa.css')

# 2. Extract internal scripts
scripts = re.findall(r'<script(?! src)(.*?)>([\s\S]*?)</script>', text)

js_content = ''
for attrs, content in scripts:
    if 'dataLayer' in content: 
        continue 
    js_content += content.strip() + '\n\n'

if js_content:
    with open('web/js/preventa.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    for attrs, content in scripts:
        if 'dataLayer' in content: continue
        full_tag = f'<script{attrs}>{content}</script>'
        text = text.replace(full_tag, '')

    text = text.replace('</body>', '    <script src="/js/preventa.js" defer></script>\n</body>')
    print('JS extracted to web/js/preventa.js')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(text)
