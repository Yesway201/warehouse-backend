// Fill in email
document.querySelector('input[type="email"]').value = 'test@example.com';
document.querySelector('input[type="email"]').dispatchEvent(new Event('input', { bubbles: true }));

// Fill in password
document.querySelector('input[type="password"]').value = 'password';
document.querySelector('input[type="password"]').dispatchEvent(new Event('input', { bubbles: true }));

// Click sign in button
setTimeout(() => {
  document.querySelector('button[type="submit"]').click();
}, 100);
