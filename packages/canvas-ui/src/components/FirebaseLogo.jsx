import React from 'react';

export default function FirebaseLogo({ size = 16, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Left flame segment (Amber) */}
      <path
        d="M5.617 26.549L4.088 17.02c-.225-1.405.656-2.698 2.016-2.955 1.054-.2 2.115.352 2.534 1.321l4.248 9.907-7.269 1.256z"
        fill="#FFA000"
      />
      {/* Tall back flame segment (Orange) */}
      <path
        d="M17.487 3.518c-.76-1.196-2.484-1.229-3.284-.066L3.985 24.08l1.632 2.469 11.87-23.03z"
        fill="#F57C00"
      />
      {/* Front body flame segment (Bright Yellow) */}
      <path
        d="M18.847 12.384c-.818-.891-2.269-.877-3.07.03l-10.16 11.666 8.94 5.03c.895.503 1.99.503 2.885 0l9.014-5.071-7.61-11.655z"
        fill="#FFCA28"
      />
    </svg>
  );
}
