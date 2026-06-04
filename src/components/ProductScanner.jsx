import { useRef } from "react";

function ProductScanner() {

  const imageRef = useRef();

  const handleUpload = (e) => {
    const file = e.target.files[0];

    if (file) {
      imageRef.current.src = URL.createObjectURL(file);
    }
  };

  return (
    <div className="scanner-panel">
      <h2>Scan Product</h2>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
      />

      <img ref={imageRef} width="250" alt="Scanned item preview" />
    </div>
  );
}

export default ProductScanner;