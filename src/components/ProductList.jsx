const products = [
  {
    name: "Milk",
    days: 25,
    status: "Safe"
  },
  {
    name: "Paracetamol",
    days: 10,
    status: "Warning"
  },
  {
    name: "Bread",
    days: 2,
    status: "Critical"
  }
];

function ProductList() {
  return (
    <div className="product-list">
      <h2>Products</h2>

      {products.map((item,index)=>(
        <div className="card" key={index}>
          <h3>{item.name}</h3>
          <p>{item.days} Days Left</p>
          <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}

export default ProductList;