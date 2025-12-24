// 主导航菜单交互
function initializeSiteInteractions() {
    // 资源中心页面的标签切换功能
    const tabButtons = document.querySelectorAll('.tab-button');
    const resourceItems = document.querySelectorAll('.resource-item');
    
    if (tabButtons.length > 0 && resourceItems.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // 移除所有按钮的激活状态
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // 添加当前按钮的激活状态
                this.classList.add('active');
                
                // 获取要显示的类别
                const category = this.getAttribute('data-category');
                
                // 显示对应类别的资源
                resourceItems.forEach(item => {
                    if (category === 'all' || item.getAttribute('data-category') === category) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }
    
    // 移动端菜单切换
    const mobileMenuButton = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('nav ul');
    
    if (mobileMenuButton && nav) {
        mobileMenuButton.addEventListener('click', function() {
            nav.classList.toggle('mobile-active');
        });
    }
    
    // 头部滚动效果
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
    
    // 平滑滚动效果
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // 模块项悬停效果增强
    const moduleItems = document.querySelectorAll('.module-item');
    moduleItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // 文档中心 Markdown 加载
    const docLinks = document.querySelectorAll('.doc-link');
    const docContent = document.getElementById('doc-content');
    
    if (docLinks.length > 0 && docContent) {
        let docDataCache = null;
        const inlineDocData = document.getElementById('docs-data');
        if (inlineDocData) {
            try {
                docDataCache = JSON.parse(inlineDocData.textContent);
            } catch (error) {
                console.error('解析嵌入的文档数据失败', error);
            }
        }
        
        if (!docDataCache && window.DOCS_DATA) {
            docDataCache = window.DOCS_DATA;
        }
        if (window.marked && window.marked.setOptions) {
            window.marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
        
        const docTitle = document.getElementById('doc-title');
        const docSourceLink = document.getElementById('doc-source-link');
        
        const setActiveLink = (targetLink) => {
            docLinks.forEach(link => link.classList.remove('active'));
            targetLink.classList.add('active');
        };
        
        const renderMarkdown = (text) => {
            if (window.marked) {
                return window.marked.parse(text);
            }
            return `<pre>${text}</pre>`;
        };
        
        const loadDoc = async (targetLink) => {
            if (!targetLink) return;
            
            setActiveLink(targetLink);
            const filePath = targetLink.getAttribute('data-file');
            const title = targetLink.getAttribute('data-title') || targetLink.textContent.trim();
            
            if (docTitle) {
                docTitle.textContent = title;
            }
            
            if (docSourceLink && filePath) {
                docSourceLink.href = filePath;
                docSourceLink.classList.remove('disabled');
            }
            
            docContent.innerHTML = '<p class="doc-loading">文档加载中，请稍候...</p>';
            
            const embeddedDoc = docDataCache ? docDataCache[filePath] : null;
            if (embeddedDoc) {
                docContent.innerHTML = renderMarkdown(embeddedDoc);
                docContent.scrollTop = 0;
                return;
            }
            
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const markdown = await response.text();
                docContent.innerHTML = renderMarkdown(markdown);
                docContent.scrollTop = 0;
            } catch (error) {
                console.error('文档加载失败', error);
                if (location.protocol === 'file:') {
                    const fallbackWrapper = document.createElement('div');
                    fallbackWrapper.className = 'doc-fallback';
                    fallbackWrapper.innerHTML = '<p class=\"doc-error\">无法直接读取本地 Markdown，已切换为原始文件预览模式。</p>';
                    
                    const iframe = document.createElement('iframe');
                    iframe.src = filePath;
                    iframe.className = 'doc-fallback-frame';
                    iframe.setAttribute('title', `${title} 原始内容`);
                    
                    fallbackWrapper.appendChild(iframe);
                    docContent.innerHTML = '';
                    docContent.appendChild(fallbackWrapper);
                } else {
                    docContent.innerHTML = `<div class="doc-error">文档加载失败：${error.message}</div>`;
                }
            }
        };
        
        docLinks.forEach(link => {
            link.addEventListener('click', () => loadDoc(link));
        });
        
        loadDoc(document.querySelector('.doc-link.active') || docLinks[0]);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSiteInteractions);
} else {
    initializeSiteInteractions();
}

// 图片加载错误处理
document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.src = 'images/placeholder.png';
    }
}, true);

// 页面加载完成后的初始化
window.addEventListener('load', function() {
    // 添加页面加载完成的标识
    document.body.classList.add('loaded');
    
    // 初始化任何需要延迟加载的组件
    initializeComponents();
});

// 初始化组件函数
function initializeComponents() {
    // 这里可以添加更多组件初始化逻辑
    console.log('页面组件初始化完成');
    
    // 添加模块动画效果
    animateModulesOnScroll();
}

// 滚动时触发动画效果
function animateModulesOnScroll() {
    const moduleItems = document.querySelectorAll('.module-item, .feature-card, .case-item, .resource-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });
    
    moduleItems.forEach(item => {
        item.style.opacity = 0;
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(item);
    });
}
