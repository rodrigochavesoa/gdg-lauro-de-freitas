import React from "react";

function buildSrcSet(basePath, extension, widths) {
  return widths.map((width) => `${basePath}-${width}.${extension} ${width}w`).join(", ");
}

export function ResponsiveAssetImage({
  src,
  sourceBase,
  sourceWidths = [],
  sizes,
  alt = "",
  ...imageProps
}) {
  return (
    <picture>
      {sourceBase && sourceWidths.length > 0 ? (
        <>
          <source
            type="image/avif"
            srcSet={buildSrcSet(sourceBase, "avif", sourceWidths)}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={buildSrcSet(sourceBase, "webp", sourceWidths)}
            sizes={sizes}
          />
        </>
      ) : null}
      <img src={src} alt={alt} sizes={sizes} {...imageProps} />
    </picture>
  );
}
