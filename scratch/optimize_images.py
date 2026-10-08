import os
import shutil
from PIL import Image

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ASSETS_DIR = os.path.join(ROOT_DIR, 'assets')
BACKUP_DIR = os.path.join(ROOT_DIR, 'scratch', 'backup_pre_implementation', 'assets')

os.makedirs(BACKUP_DIR, exist_ok=True)

image_extensions = ('.png', '.jpg', '.jpeg', '.webp')

total_before = 0
total_after = 0
processed_count = 0

print("Scanning assets directory for images to optimize...")

for root, dirs, files in os.walk(ASSETS_DIR):
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in image_extensions:
            src_path = os.path.join(root, f)
            rel_path = os.path.relpath(src_path, ROOT_DIR)
            size_before = os.path.getsize(src_path)
            total_before += size_before

            # Backup
            backup_path = os.path.join(ROOT_DIR, 'scratch', 'backup_pre_implementation', rel_path)
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            if not os.path.exists(backup_path):
                shutil.copy2(src_path, backup_path)

            # Optimize if > 150 KB
            if size_before > 150 * 1024:
                try:
                    img = Image.open(src_path)
                    w, h = img.size
                    max_dim = 1920

                    # Resize if unreasonably huge
                    if w > max_dim or h > max_dim:
                        ratio = min(max_dim / w, max_dim / h)
                        new_w = int(w * ratio)
                        new_h = int(h * ratio)
                        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                    # Save optimized based on format
                    if ext == '.webp':
                        if img.mode in ('RGBA', 'LA'):
                            img.save(src_path, 'WEBP', quality=82, method=6)
                        else:
                            img.convert('RGB').save(src_path, 'WEBP', quality=82, method=6)
                    elif ext in ('.jpg', '.jpeg'):
                        img.convert('RGB').save(src_path, 'JPEG', quality=82, optimize=True)
                        # Also generate webp pair if doesn't exist
                        webp_pair = os.path.splitext(src_path)[0] + '.webp'
                        img.convert('RGB').save(webp_pair, 'WEBP', quality=82, method=6)
                    elif ext == '.png':
                        # If RGBA, save optimized PNG and also generate/update webp pair
                        if img.mode in ('RGBA', 'LA'):
                            img.save(src_path, 'PNG', optimize=True)
                            webp_pair = os.path.splitext(src_path)[0] + '.webp'
                            img.save(webp_pair, 'WEBP', quality=82, method=6)
                        else:
                            # RGB PNG can be saved with optimize=True
                            img.save(src_path, 'PNG', optimize=True)
                            webp_pair = os.path.splitext(src_path)[0] + '.webp'
                            img.convert('RGB').save(webp_pair, 'WEBP', quality=82, method=6)

                    size_after = os.path.getsize(src_path)
                    total_after += size_after
                    processed_count += 1
                    print(f"Optimized {rel_path}: {size_before/1024:.1f} KB -> {size_after/1024:.1f} KB ({(1-size_after/size_before)*100:.1f}% reduction)")
                except Exception as e:
                    print(f"Error optimizing {rel_path}: {e}")
                    total_after += size_before
            else:
                total_after += size_before

print(f"\nImage Optimization Summary:")
print(f"  Processed {processed_count} large images.")
print(f"  Total weight before: {total_before / (1024*1024):.2f} MB")
print(f"  Total weight after:  {total_after / (1024*1024):.2f} MB")
print(f"  Total savings:       {(total_before - total_after) / (1024*1024):.2f} MB ({(1 - total_after/total_before)*100:.1f}%)")
