import os
import re

base_dir = r"c:\PROYECTOS\SIPRO_07\frontend\src\app\modules"

def refactor_html():
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original_content = content
                
                # 1. Update <p-dialog ...>
                # Some have styleClass="..."
                content = re.sub(r'styleClass="([^"]*modal[^"]*|p-fluid[^"]*|custom-patrimonio-dialog[^"]*)"', 'styleClass="app-custom-modal"', content)
                
                def add_styleclass(match):
                    tag_content = match.group(0)
                    if 'styleClass=' not in tag_content:
                        if tag_content.endswith('/>'):
                            return tag_content[:-2] + ' styleClass="app-custom-modal"/>'
                        else:
                            return tag_content[:-1] + ' styleClass="app-custom-modal">'
                    return tag_content

                content = re.sub(r'<p-dialog[^>]*>', add_styleclass, content)

                # 2. Update <div class="card-header ...">
                content = re.sub(r'class="([^"]*card-header\s+bg-(?:primary|success|info|warning)[^"]*)"', 'class="card-header app-custom-header text-white"', content)
                content = re.sub(r'class="card-header bg-white border-0 py-2"', 'class="card-header app-custom-header text-white"', content)
                content = re.sub(r'class="card-header bg-white border-0 py-3"', 'class="card-header app-custom-header text-white"', content)

                # Also replace any other loose card-header without bg- that are used as main titles.
                # Actually, only the ones we know of to be safe.

                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated HTML: {filepath}")

refactor_html()
