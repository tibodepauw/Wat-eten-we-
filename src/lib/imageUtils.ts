/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compresses an image file client-side using a canvas.
 * Automatically downscales if dimensions exceed maxDimension and applies JPEG compression.
 * @param file The file to compress.
 * @param maxDimension The maximum width or height of the output image in pixels.
 * @param quality The JPEG compression quality (0.0 to 1.0).
 * @returns A Promise that resolves to a base64-encoded JPEG DataURL.
 */
export function compressImage(file: File, maxDimension = 1024, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale maintaining aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2d context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        try {
          // Export as JPEG with chosen quality to drastically reduce size
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = (err) => {
        reject(new Error('Fout bij het laden van de afbeelding in een image element'));
      };
      
      img.src = event.target?.result as string;
    };
    
    reader.onerror = (err) => {
      reject(new Error('Fout bij het inlezen van het bestand'));
    };
    
    reader.readAsDataURL(file);
  });
}

export interface ImagePreset {
  label: string;
  url: string;
  category: string;
}

export const DISH_IMAGE_PRESETS: ImagePreset[] = [
  { label: 'Pasta', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80', category: 'Italiaans' },
  { label: 'Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80', category: 'Italiaans' },
  { label: 'Burger', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80', category: 'Fastfood' },
  { label: 'Salade', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80', category: 'Gezond' },
  { label: 'Soep', url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80', category: 'Soep' },
  { label: 'Lasagne', url: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&auto=format&fit=crop&q=80', category: 'Ovenschotel' },
  { label: 'Curry / Wok', url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&auto=format&fit=crop&q=80', category: 'Aziatisch' },
  { label: 'Biefstuk / Vlees', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80', category: 'Vlees' },
  { label: 'Vis / Zalm', url: 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=800&auto=format&fit=crop&q=80', category: 'Vis' },
  { label: 'Pannenkoeken', url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80', category: 'Ontbijt' },
  { label: 'Dessert', url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=800&auto=format&fit=crop&q=80', category: 'Zoet' },
  { label: 'Stamppot / AGV', url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80', category: 'Hollands' }
];
