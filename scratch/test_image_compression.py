import os
from PIL import Image

test_files = [
    'assets/ai/vyomantra_ai_core.jpg',
    'assets/Team/sachin.png',
    'assets/photos/home_bakers/home_bakers_1.png'
]

for tf in test_files:
    if os.path.exists(tf):
        orig_size = os.path.getsize(tf)
        img = Image.open(tf)
        print(f"File: {tf}, Original size: {orig_size / 1024:.1f} KB, Dims: {img.size}, Mode: {img.mode}")
        
        # Test WebP conversion
        webp_name = tf.rsplit('.', 1)[0] + '.test.webp'
        if img.mode in ('RGBA', 'LA'):
            img.save(webp_name, 'WEBP', quality=85, method=6)
        else:
            img.convert('RGB').save(webp_name, 'WEBP', quality=82, method=6)
        webp_size = os.path.getsize(webp_name)
        print(f"  WebP size: {webp_size / 1024:.1f} KB (Savings: {(1 - webp_size/orig_size)*100:.1f}%)")
        os.remove(webp_name)
