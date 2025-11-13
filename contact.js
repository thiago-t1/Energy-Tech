// =====================
// CONTACT PAGE SCRIPT
// =====================

document.addEventListener('DOMContentLoaded', () => {
    initContactForm();
    initFAQ();
    initFormAnimations();
    initCPFMask();
    initPhoneMask();
    initMapInteraction();
});

// =====================
// CONTACT FORM
// =====================

function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const submitBtn = form.querySelector('.btn-submit');
        const originalContent = submitBtn.innerHTML;

        // Loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        submitBtn.disabled = true;

        // Simulate sending
        await simulateSend();

        // Success state
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Mensagem Enviada!';
        submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';

        // Show success notification
        showNotification('Mensagem enviada com sucesso! Entraremos em contato em breve.', 'success');

        // Reset form after delay
        setTimeout(() => {
            form.reset();
            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
        }, 3000);
    });
}

function validateForm() {
    const form = document.getElementById('contactForm');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('error');

            // Remove error class on input
            field.addEventListener('input', () => {
                field.classList.remove('error');
            }, { once: true });
        }

        // Email validation
        if (field.type === 'email' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                field.classList.add('error');
                showNotification('Por favor, insira um e-mail válido.', 'error');
            }
        }

        // CPF validation (optional)
        if (field.id === 'cpf' && field.value) {
            if (!validateCPF(field.value)) {
                isValid = false;
                field.classList.add('error');
                showNotification('CPF inválido. Por favor, verifique.', 'error');
            }
        }
    });

    return isValid;
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11) return false;

    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Validate first digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit === 10 || digit === 11) digit = 0;
    if (digit !== parseInt(cpf.charAt(9))) return false;

    // Validate second digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit === 10 || digit === 11) digit = 0;
    if (digit !== parseInt(cpf.charAt(10))) return false;

    return true;
}

async function simulateSend() {
    return new Promise(resolve => {
        setTimeout(resolve, 2000);
    });
}

// =====================
// FORM ANIMATIONS
// =====================

function initFormAnimations() {
    const inputs = document.querySelectorAll('.form-group input, .form-group textarea');

    inputs.forEach(input => {
        // Add floating label effect
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', () => {
            if (!input.value) {
                input.parentElement.classList.remove('focused');
            }
        });

        // Add filled class if input has value on load
        if (input.value) {
            input.parentElement.classList.add('focused');
        }
    });

    // Animate form groups on scroll
    const formGroups = document.querySelectorAll('.form-group');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.animation = 'slideUp 0.5s ease forwards';
                }, index * 50);
            }
        });
    });

    formGroups.forEach(group => observer.observe(group));
}

// =====================
// INPUT MASKS
// =====================

function initCPFMask() {
    const cpfInput = document.getElementById('cpf');
    if (!cpfInput) return;

    cpfInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }

        e.target.value = value;
    });
}

function initPhoneMask() {
    const phoneInput = document.getElementById('telefone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 10) {
            value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (value.length > 6) {
            value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        }

        e.target.value = value;
    });
}

// =====================
// FAQ FUNCTIONALITY
// =====================

function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Close other FAQ items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');

            // Animate icon
            const icon = question.querySelector('i');
            if (item.classList.contains('active')) {
                icon.style.animation = 'rotateDown 0.3s ease forwards';
            } else {
                icon.style.animation = 'rotateUp 0.3s ease forwards';
            }
        });
    });
}

// Add rotation animations
const style = document.createElement('style');
style.textContent = `
    @keyframes rotateDown {
        from { transform: rotate(0deg); }
        to { transform: rotate(180deg); }
    }

    @keyframes rotateUp {
        from { transform: rotate(180deg); }
        to { transform: rotate(0deg); }
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-group.error input,
    .form-group.error select,
    .form-group.error textarea {
        border-color: #f44336 !important;
        animation: shake 0.5s ease;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// =====================
// MAP INTERACTION
// =====================

function initMapInteraction() {
    const btnDirections = document.querySelector('.btn-directions');
    if (!btnDirections) return;

    btnDirections.addEventListener('click', () => {
        // Open Google Maps with directions
        const address = 'Sorocaba, São Paulo, Brasil';
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    });
}

// =====================
// NOTIFICATION SYSTEM
// =====================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    let icon = 'info-circle';
    let bgColor = 'var(--light-gray)';

    if (type === 'success') {
        icon = 'check-circle';
        bgColor = '#4CAF50';
    } else if (type === 'error') {
        icon = 'exclamation-circle';
        bgColor = '#f44336';
    }

    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        box-shadow: var(--shadow-lg);
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// =====================
// SMOOTH ANIMATIONS
// =====================

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroParticles = document.querySelector('.hero-particles');

    if (heroParticles) {
        heroParticles.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Animate contact info items on hover
document.querySelectorAll('.info-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        const icon = item.querySelector('i');
        icon.style.animation = 'pulse 0.5s ease';
    });

    item.addEventListener('mouseleave', () => {
        const icon = item.querySelector('i');
        icon.style.animation = '';
    });
});

// Add pulse animation
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
`;
document.head.appendChild(pulseStyle);

// =====================
// QUICK ACTIONS
// =====================

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const text = btn.textContent.trim();

        if (text.includes('Simular')) {
            // Redirect to calculator
            window.location.href = 'index.html#calculator';
        } else if (text.includes('Catálogo')) {
            // Download catalog
            showNotification('Iniciando download do catálogo...', 'success');
            // Simulate download
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = '#'; // Add actual PDF link here
                link.download = 'EnergyTech_Catalogo_2025.pdf';
                link.click();
            }, 1000);
        }
    });
});

console.log('Contact page initialized successfully!');