# Getting Started

This is another **test** note _loaded_


## **Features**

* Test vault with hardcoded path
* localStorage-based storage for edits
* Files initially loaded from `test/files/` directory


## Headings

# **Heading 1**

### **Heading 2**

###### **Heading 3**


## **Blockquotes**

> This is some blockquote
>
> It can also have a list
>
> * item 1
> * item 2
> * item 3 with some `code` .


## Links

This is a [test link](http://example.com) in a paragraph.

Visit [Google](https://www.google.com) for more information.


## Code Blocks

```python
def greet(name):
    """Greet a person with their name"""
    message = f"Hello, {name}!"
    return message

if __name__ == "__main__":
    result = greet("World")
    print(result)
```

```javascript
function calculateSum(numbers) {
  // Calculate sum using reduce
  const total = numbers.reduce((acc, num) => acc + num, 0);
  return total;
}

const numbers = [1, 2, 3, 4, 5];
const result = calculateSum(numbers);
console.log(`The sum is: ${result}`);
```

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function createUser(name: string, email: string): User {
  return {
    id: Math.random(),
    name,
    email
  };
}

const user = createUser("John Doe", "john@example.com");
```

## Lists

- [ ] abc
- [ ] def
