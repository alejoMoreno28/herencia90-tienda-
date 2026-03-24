import os
from pathlib import Path
from rembg import remove
from PIL import Image

def process_images(input_dir, output_dir):
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    for team_dir in input_path.iterdir():
        if team_dir.is_dir():
            for img_file in team_dir.iterdir():
                if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                    # Clean filename
                    team_clean = team_dir.name.replace(' ', '_').lower()
                    out_name = f"{team_clean}_{img_file.stem}.png"
                    out_file = output_path / out_name
                    
                    if out_file.exists():
                        continue
                    
                    print(f"Processing {img_file.name} in {team_dir.name}...")
                    try:
                        input_img = Image.open(img_file)
                        # Remove background
                        output_img = remove(input_img)
                        # Save
                        output_img.save(out_file, "PNG")
                        print(f"Saved to {out_file}")
                    except Exception as e:
                        print(f"Error processing {img_file}: {e}")

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    equipos_dir = base_dir / "EQUIPOS"
    img_out_dir = base_dir / "web" / "img"
    process_images(equipos_dir, img_out_dir)
    print("All images processed!")
