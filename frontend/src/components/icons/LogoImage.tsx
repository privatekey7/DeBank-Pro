import React, { useState } from 'react';

interface LogoImageProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LogoImage: React.FC<LogoImageProps> = ({ 
  src, 
  alt, 
  size = 'md',
  className = '' 
}) => {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg'
  };

  // Если нет src или произошла ошибка загрузки, показываем инициалы
  if (!src || src === '' || src === 'undefined' || src === 'null' || imageError) {
    const initials = alt
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div 
        className={`${sizeClasses[size]} bg-slate-700 rounded-lg flex items-center justify-center ${className}`}
        title={alt}
      >
        <span className={`font-medium text-slate-300 ${textSizes[size]}`}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} rounded-lg object-cover ${className}`}
      onError={() => setImageError(true)}
      title={alt}
      loading="lazy"
    />
  );
};

export default LogoImage; 