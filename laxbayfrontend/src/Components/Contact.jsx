export default function ContactUs() {
    return (
      <div className="p-8 max-w-3xl mx-auto bg-white shadow-lg rounded-lg">
        <h1 className="text-3xl font-semibold text-center mb-8">Contact Us</h1>
        
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-gray-800">Email</h2>
          <p className="text-gray-600 text-sm">
            For general inquiries, please contact us at:
          </p>
          <a href="mailto:contact@company.com" className="text-blue-600 hover:underline">
            contact@company.com
          </a>
        </div>
  
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-gray-800">Phone Number</h2>
          <p className="text-gray-600 text-sm">
            Reach us by phone at the following number:
          </p>
          <p className="text-blue-600">
            <a href="tel:+1234567890">(123) 456-7890</a>
          </p>
        </div>
  
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-gray-800">Mailing Address</h2>
          <p className="text-gray-600 text-sm">
            If you'd prefer to send us mail, our office address is:
          </p>
          <address className="text-gray-600 text-sm">
            1234 Business St.<br />
            Suite 100<br />
            City, State, 12345
          </address>
        </div>
      </div>
    );
  }