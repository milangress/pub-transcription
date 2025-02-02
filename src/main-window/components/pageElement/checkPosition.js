export function checkPosition(element, params) {
    // If no params provided or explicitly set to null, don't do any checking
    if (!params) return { destroy() {} };

    const { onOverflow } = params;
    const page = element.closest('page');
    if (!page) return { destroy() {} };
    
    const pageRect = page.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    const distanceToBottom = pageRect.height - (elementRect.bottom - pageRect.top);
    const percentToBottom = (distanceToBottom / pageRect.height) * 100;
    
    // Only log if we're actually checking position
    console.log("Element space check:", {
        content: element.textContent?.trim(),
        distanceToBottom,
        percentToBottom
    });

    if (distanceToBottom < 0 || percentToBottom < 5) {
        onOverflow(element);
    }

    return {
        destroy() {
            // Cleanup if needed
        }
    };
}
