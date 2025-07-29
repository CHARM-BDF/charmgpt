Here's the chat message:

```markdown
# React Component Example

Here's a reusable contact form component that includes:
- Form validation
- Error handling
- Success feedback
- Responsive design

<button 
      class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline"
      data-artifact-id="939a3a05-4253-4928-8aed-c2b6350b7272" 
      data-artifact-type="application/vnd.react"
      style="cursor: pointer; background: none; border: none; padding: 0;"
    >📎 Contact Form Component</button>

And here's the accompanying CSS:

<button 
      class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline"
      data-artifact-id="1b725315-36cc-4511-ad75-65936822a4f9" 
      data-artifact-type="text/css"
      style="cursor: pointer; background: none; border: none; padding: 0;"
    >📎 Contact Form Styles</button>

To use this component, you would import it like this:

```jsx
import ContactForm from './ContactForm';

function App() {
    const handleSubmit = async (formData) => {
        // Handle form submission
        console.log(formData);
        // Make API call, etc.
    };

    return (
        <div>
            <h1>Contact Us</h1>
            <ContactForm onSubmit={handleSubmit} />
        </div>
    );
}
```

This component includes:
- Form validation with error messages
- Loading state during submission
- Success/error feedback
- Responsive styling
- Clean error handling
- Proper typing feedback
- Accessibility considerations

Would you like me to explain any specific part of the implementation?