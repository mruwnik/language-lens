export const SPEAKER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;cursor:pointer;margin-left:4px">
    <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
</svg>`;

export const TOOLTIP_STYLES = `
.language-lens-word {
    position: relative;
    cursor: help;
}
.language-lens-tooltip {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 8px;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 10000;
    max-width: 300px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px);
    transition: opacity 0.2s, transform 0.2s, visibility 0s linear 0.2s;
    left: 0;
    top: calc(100% + 5px);
}
.language-lens-word:hover .language-lens-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition-delay: 0s;
}
.language-lens-tooltip::before {
    content: '';
    position: absolute;
    left: -10px;
    right: -10px;
    height: 20px;
    bottom: 100%;
}
.language-lens-tooltip-original {
    color: #666;
    font-style: italic;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
}
.language-lens-tooltip-translations {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.language-lens-translation-item {
    display: flex;
    align-items: center;
    gap: 8px;
}
.language-lens-translation-text {
    font-weight: 500;
}
.language-lens-translation-reading {
    color: #666;
}
.language-lens-speak-icon {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    color: #666;
    transition: color 0.2s;
    margin-left: auto;
}
.language-lens-speak-icon:hover {
    color: #007bff;
}
`; 