export default `<svg>
<filter id="glitch">
	<feTurbulence type="fractalNoise" baseFrequency="0.03 0.01" numOctaves="1" result="warp" id="turb"/>
	<feColorMatrix in="warp" result="huedturb" type="hueRotate" values="90">
	<animate attributeType="XML" attributeName="values" values="0;180;360" dur="6s"
                         repeatCount="indefinite"/>
	</feColorMatrix>
	<feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="huedturb"/>
</filter>

<filter id="distort">
  <feTurbulence baseFrequency="0.01 0.01" numOctaves="1" result="noise"  />
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="R">
</filter>

<filter id="grain">
  <feTurbulence type="turbulence"
    baseFrequency="0.1" numOctaves="2" result="turbulence"/>
  <feDisplacementMap in2="turbulence" in="SourceGraphic"
    scale="10" xChannelSelector="R" yChannelSelector="G" />
</filter>

<filter id="swoot">
	<feTurbulence type="turbulence" baseFrequency="0.015 0.1" numOctaves="2" seed="2" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence"/>
	<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="15" xChannelSelector="R" yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap1"/>
</filter>

<filter id="outline">
      <feMorphology operator="dilate" radius="12" in="SourceGraphic" result="THICKNESS" />
      <feComposite operator="out" in="THICKNESS" in2="SourceGraphic"></feComposite>
</filter>

<filter id="motion-blur">
	<feGaussianBlur in="SourceGraphic" stdDeviation="5,0" />
</filter>

<filter id="blobs" color-interpolation-filters="sRGB" x="-50%" y="-50%" height="200%" width="200%">
	<feOffset id="offset" in="SourceAlpha" dx="0" dy="0" result="SA-offset"/>
	<feGaussianBlur id="blur" in="SA-offset" stdDeviation="5.5" result="SA-o-blur"/>
	<feComponentTransfer in="SA-o-blur" result="SA-o-b-contIN">
	  <feFuncA id="contour" type="table" tableValues="0 0.05 0.15 0.45 0.7 0.85 0.95 1 0.95 0.85 0.7 0.45 0.15 0.05 0 0.05 0.15 0.45 0.7 0.85 0.95 1 0.95 0.85 0.7 0.45 0.15 0.05 0 0.05 0.15 0.45 0.7 0.85 0.95 1"/>
	</feComponentTransfer>
	<feComposite operator="in" in="SA-o-blur" in2="SA-o-b-contIN" result="SA-o-b-cont"/>
	<feComponentTransfer in="SA-o-b-cont" result="SA-o-b-c-sprd">
	  <feFuncA id="spread-ctrl" type="linear" slope="5.1"/>
	</feComponentTransfer>
	<feColorMatrix id="recolor" in="SA-o-b-c-sprd" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="SA-o-b-c-s-recolor"/>
	<feTurbulence result="fNoise" type="fractalNoise" numOctaves="6" baseFrequency="1.98"/>
	<feColorMatrix in="fNoise" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 7 -3" result="clipNoise"/>
	<feComposite id="noisemix" operator="arithmetic" in="SA-o-b-c-s-recolor" in2="clipNoise" k1="0" k2="1" result="SA-o-b-c-s-r-mix"/>
	<feMerge>
	  <feMergeNode in="SA-o-b-c-s-r-mix"/>
	  <feMergeNode in="SourceGraphic"/>
	</feMerge>
</filter>

<filter id="fire" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feGaussianBlur stdDeviation="0 10" x="0%" y="0%" width="100%" height="100%" in="SourceGraphic" edgeMode="none" result="blur"/>
  <feTurbulence type="turbulence" baseFrequency="0.06 0.015" numOctaves="2" seed="2" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence1"/>
  <feColorMatrix type="matrix" values="1 0 0 0 0
0 1 0 0 0
0 0 1 0 0
0 0 0 5 -1" x="0%" y="0%" width="100%" height="100%" in="turbulence1" result="colormatrix2"/>
  <feColorMatrix type="matrix" values="1 0 0 0 0
0 1 0 0 0
0 0 1 0 0
0 0 0 3 0" x="0%" y="0%" width="100%" height="100%" in="turbulence1" result="colormatrix3"/>
  <feComposite in="colormatrix2" in2="blur" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite1"/>
  <feFlood flood-color="#ff853a" flood-opacity="1" x="0%" y="0%" width="100%" height="100%" result="flood1"/>
  <feComposite in="flood1" in2="composite1" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite2"/>
  <feOffset dx="-5" dy="-20" x="0%" y="0%" width="100%" height="100%" in="composite2" result="offset1"/>
  <feMorphology operator="dilate" radius="0 10" x="0%" y="0%" width="100%" height="100%" in="offset1" result="morphology"/>
  <feDisplacementMap in="morphology" in2="turbulence1" scale="20" xChannelSelector="G" yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap1"/>
  <feComposite in="merge3" in2="colormatrix3" operator="out" x="0%" y="0%" width="100%" height="100%" result="composite3"/>
  <feFlood flood-color="#ff8422" flood-opacity="1" x="0%" y="0%" width="100%" height="100%" result="flood2"/>
  <feComposite in="flood2" in2="composite3" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite4"/>
  <feMerge x="0%" y="0%" width="100%" height="100%" result="merge3">
          <feMergeNode in="displacementMap1"/>
      <feMergeNode in="SourceGraphic"/>
      <feMergeNode in="composite4"/>
  </feMerge>
</filter>

</svg>
` 