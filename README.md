# Segmentation UI for Computer Vision Training (Work in Progress)

**IMPORTANT: This project is currently under active development and is not yet fully functional. Many features are still being implemented and may not work as described.**

This project is a web-based application designed to facilitate the creation and management of image segmentation data for training computer vision algorithms. It aims to provide an intuitive user interface for annotating images with pixel-precise segmentation masks, which can be used to train and improve various computer vision models.

## Planned Features

- [ ] **Image Upload**: Easily upload and manage multiple images for segmentation.
- [ ] **Interactive Segmentation**: Utilize the Segment Anything Model (SAM) for efficient and accurate segmentation.
- [ ] **Label Management**: Create, edit, and apply labels to segmented regions.
- [ ] **Mask Editing**: Add or remove regions from existing segmentation masks.
- [ ] **Visualization Tools**: Toggle mask visibility, adjust opacity, and change mask colors for better visualization.
- [ ] **Export Capabilities**: Save segmentation data in formats compatible with popular computer vision frameworks.

## Current Tech Stack

- **Frontend**: Next.js with React
- **Backend**: FastAPI
- **Segmentation Model**: Segment Anything Model (SAM)
- **Additional Libraries**: OpenCV, PyTorch

## Getting Started

**Note: These instructions are for the planned final version. The current implementation may not support all these steps.**

### Prerequisites

- Node.js (v14 or later)
- Python (v3.8 or later)
- CUDA-capable GPU (recommended for optimal performance)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/segmentation-ui.git
   cd segmentation-ui
   ```

2. Install frontend dependencies:
   ```
   npm install
   ```

3. Install backend dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Download the SAM checkpoint file and place it in the appropriate directory (exact location to be determined).

### Running the Application

1. Start the backend server:
   ```
   python backend.py
   ```

2. In a new terminal, start the frontend development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000` to use the application.

## Current Status and Limitations

- The user interface is partially implemented but may lack full functionality.
- Backend integration is ongoing and may not support all planned features.
- Error handling and edge cases are still being addressed.
- Performance optimizations have not yet been implemented.
- The export functionality is not yet available.

## Planned Usage (Not Yet Fully Implemented)

1. Upload images using the "Load Images" button.
2. Select or create a label for the segment you want to annotate.
3. Use the "New Segment" button to start segmenting an area.
4. Click on the image to add points for the segmentation model to use.
5. Adjust the segmentation using the "Add Regions" and "Remove Regions" tools.
6. Save the segment when you're satisfied with the result.
7. Repeat the process for all objects in the image.
8. Use the navigation controls to move between images in your dataset.

## Contributing

As this project is still in development, contributions are welcome but please be aware that significant changes may occur. Feel free to submit issues for bugs or feature requests.

## License

This project is intended to be licensed under the MIT License - see the LICENSE file for details (to be added).

## Acknowledgments

- The Segment Anything Model (SAM) team at Meta AI Research
- The FastAPI and Next.js communities for their excellent frameworks

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. Use at your own risk.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
