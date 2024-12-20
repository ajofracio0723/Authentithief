import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import { FaBitcoin, FaEthereum, FaCube, FaCamera } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import jsQR from 'jsqr';
import { Alert } from 'react-bootstrap';

const QRScanner = () => {
  const router = useRouter();
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showInvalidAlert, setShowInvalidAlert] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const isProcessingRef = useRef(false);
  const scanIntervalRef = useRef(null);
  const lastValidScanRef = useRef(null);

  const handleInvalidQR = useCallback((message) => {
    if (!lastValidScanRef.current || Date.now() - lastValidScanRef.current > 3000) {
      setShowInvalidAlert(true);
      console.error(message);
      lastValidScanRef.current = Date.now();
      setTimeout(() => setShowInvalidAlert(false), 3000);
    }
  }, []);

  const handleRedirect = useCallback((productDetails) => {
    setIsLoading(true);
    setShowSuccessAlert(true);
    
    // Add a minimum loading time of 1.5 seconds for better UX
    setTimeout(() => {
      router.push(
        `/product-status?name=${productDetails.name}&brand=${productDetails.brand}&uniqueIdentifier=${productDetails.uniqueIdentifier}&registeredDateTime=${productDetails.registeredDateTime}&isReAuthenticated=${productDetails.isReAuthenticated}`
      );
    }, 1500);
  }, [router]);

  const processQRCode = useCallback(async () => {
    const video = videoRef.current;
    if (!video || isProcessingRef.current || !isScanning) return false;

    isProcessingRef.current = true;

    try {
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        try {
          const productDetails = JSON.parse(code.data);

          if (!productDetails.uniqueIdentifier || !productDetails.name || !productDetails.brand) {
            throw new Error('Invalid QR code data');
          }

          const isScannedBefore = localStorage.getItem(`scanned_${productDetails.uniqueIdentifier}`);
          productDetails.isReAuthenticated = !!isScannedBefore;

          if (!isScannedBefore) {
            localStorage.setItem(`scanned_${productDetails.uniqueIdentifier}`, true);
          }

          setIsScanning(false);
          handleRedirect(productDetails);
          return true;
        } catch (err) {
          handleInvalidQR('Invalid QR code format or data.');
        }
      }
    } catch (err) {
      console.error('Error processing QR code:', err);
    } finally {
      isProcessingRef.current = false;
    }
    
    return false;
  }, [handleRedirect, handleInvalidQR, isScanning]);

  const handleFileInputChange = useCallback(
    async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const imageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.readAsDataURL(file);
        });

        const img = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        const canvasContext = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        canvasContext.drawImage(img, 0, 0, img.width, img.height);

        const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          const productDetails = JSON.parse(code.data);

          if (!productDetails.uniqueIdentifier || !productDetails.name || !productDetails.brand) {
            throw new Error('Invalid QR code data');
          }

          const isScannedBefore = localStorage.getItem(`scanned_${productDetails.uniqueIdentifier}`);
          productDetails.isReAuthenticated = !!isScannedBefore;

          if (!isScannedBefore) {
            localStorage.setItem(`scanned_${productDetails.uniqueIdentifier}`, true);
          }

          handleRedirect(productDetails);
        } else {
          handleInvalidQR('No QR code detected in the uploaded image.');
        }
      } catch (err) {
        handleInvalidQR('Invalid QR code format or data.');
      }

      e.target.value = null;
    },
    [handleRedirect, handleInvalidQR]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startVideoStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        video.srcObject = stream;
        
        video.addEventListener('loadedmetadata', () => {
          video.play();
          scanIntervalRef.current = setInterval(async () => {
            if (isScanning) {
              const found = await processQRCode();
              if (found) {
                clearInterval(scanIntervalRef.current);
              }
            }
          }, 500);
        });
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    };

    startVideoStream();

    return () => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [processQRCode, isScanning]);

  return (
    <div className="container-fluid" style={{ ...containerStyle, paddingTop: '50px' }}>
      <Header />
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card" style={cardStyle}>
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-center mb-4">
                <FaBitcoin style={cryptoIconStyle} />
                <FaEthereum style={cryptoIconStyle} />
                <FaCube style={cryptoIconStyle} />
              </div>
              <h2 className="text-center mb-4" style={authentithiefTitleStyle}>AUTHENTITHIEF</h2>
              <h1 className="text-center mb-4" style={titleStyle}>
                <FaCamera style={{ marginRight: '0.5rem' }} />
                QR Code Scanner
              </h1>
              <div className="scanner-container" style={scannerContainerStyle}>
                {isLoading ? (
                  <div className="loading-overlay" style={loadingOverlayStyle}>
                    <Loader2 className="animate-spin" size={48} />
                    <p className="mt-3">Processing QR Code...</p>
                  </div>
                ) : (
                  <video ref={videoRef} style={videoStyle} />
                )}
                {showSuccessAlert && !isLoading && (
                  <Alert
                    variant="success"
                    onClose={() => setShowSuccessAlert(false)}
                    dismissible
                    className="small-alert"
                    style={alertStyle}
                  >
                    Scanning complete
                  </Alert>
                )}
                {showInvalidAlert && (
                  <Alert
                    variant="danger"
                    onClose={() => setShowInvalidAlert(false)}
                    dismissible
                    className="small-alert"
                    style={alertStyle}
                  >
                    Invalid QR code
                  </Alert>
                )}
              </div>
              <button
                className="btn btn-primary w-100 mt-3"
                onClick={() => fileInputRef.current.click()}
                disabled={isLoading}
              >
                Upload QR Code Image
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const containerStyle = {
  background: 'radial-gradient(circle, #330066, #000000)',
  minHeight: '100vh',
  color: '#fff',
};

const cardStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  padding: '3rem',
  borderRadius: '10px',
  boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
};

const authentithiefTitleStyle = {
  fontSize: '3.5rem',
  fontWeight: 'bold',
  marginBottom: '2rem',
  textAlign: 'center',
  textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
  color: '#f0f0f0',
};

const titleStyle = {
  fontSize: '3rem',
  fontWeight: 'bold',
  marginBottom: '2rem',
  textAlign: 'center',
  textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
  color: '#f0f0f0',
};

const scannerContainerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  width: '100%',
  maxWidth: '500px',
  margin: '0 auto',
};

const videoStyle = {
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '10px',
};

const loadingOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: '10px',
  color: '#fff',
};

const cryptoIconStyle = {
  fontSize: '3rem',
  marginRight: '0.5rem',
  color: '#f0f0f0',
};

const alertStyle = {
  position: 'absolute',
  bottom: '10px',
  left: '50%',
  transform: 'translateX(-50%)',
  minWidth: '200px',
};

export default QRScanner;