'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAuthPayload } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding';

const categories = [
    { value: 'ring', label: 'Ring', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=200&q=80' },
    { value: 'necklace', label: 'Necklace', img: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=200&q=80' },
    { value: 'earring', label: 'Earring', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200&q=80' },
    { value: 'bracelet', label: 'Bracelet', img: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=200&q=80' },
    { value: 'pendant', label: 'Pendant', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=200&q=80' },
    { value: 'bangle', label: 'Bangle', img: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=200&q=80' },
    { value: 'other', label: 'Other', img: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=200&q=80' },
];

const inspirationImages = [
    { src: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=400&q=80', label: 'Gold collection with intricate detailing' },
    { src: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400&q=80', label: 'Statement necklace with gemstones' },
    { src: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80', label: 'Diamond solitaire rings' },
    { src: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80', label: 'Contemporary earring designs' },
];

export default function UploadPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [category, setCategory] = useState(searchParams.get('category') || '');
    const [maxUnitPrice, setMaxUnitPrice] = useState('');
    const [context, setContext] = useState('');
    const [featureSuggestions, setFeatureSuggestions] = useState<string[]>([]);
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [detectingFeatures, setDetectingFeatures] = useState(false);
    const [featureError, setFeatureError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
            setFeatureSuggestions([]);
            setSelectedFeatures([]);
            setFeatureError(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
        },
        maxSize: 10 * 1024 * 1024,
        maxFiles: 1,
    });

    useEffect(() => {
        if (!selectedFile || !category) return;

        let cancelled = false;
        const detectFeatures = async () => {
            setDetectingFeatures(true);
            setFeatureError(null);
            try {
                const result = await api.suggestImageFeatures(selectedFile, { category });
                if (cancelled) return;
                const suggestions = Array.isArray(result.features) ? result.features : [];
                setFeatureSuggestions(suggestions);
                setSelectedFeatures(suggestions);
            } catch (err) {
                if (cancelled) return;
                setFeatureSuggestions([]);
                setSelectedFeatures([]);
                setFeatureError(err instanceof Error ? err.message : 'Could not fetch AI feature suggestions.');
            } finally {
                if (!cancelled) setDetectingFeatures(false);
            }
        };

        detectFeatures();
        return () => {
            cancelled = true;
        };
    }, [selectedFile, category]);

    const toggleFeature = useCallback((feature: string) => {
        setSelectedFeatures((prev) => (
            prev.includes(feature)
                ? prev.filter((item) => item !== feature)
                : [...prev, feature]
        ));
    }, []);

    const handleUpload = async () => {
        if (!selectedFile) return;
        if (!category) {
            setError('Please select a category before uploading.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const selectedFeatureContext = selectedFeatures.length > 0
                ? `Preferred features: ${selectedFeatures.join(', ')}`
                : '';
            const uploadContext = [context.trim(), selectedFeatureContext].filter(Boolean).join(' | ');

            const result = await api.uploadImage(selectedFile, {
                category,
                context: uploadContext || undefined,
                maxUnitPrice: maxUnitPrice ? Number(maxUnitPrice) : undefined,
            });

            const payload = getAuthPayload();
            if (payload?.sub) {
                updateOnboardingStep(payload.sub, 'first_upload_completed');
            }

            router.push(`/app/recommendations/${result.sessionId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
            setUploading(false);
        }
    };

    return (
        <main className="py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Link href="/app" className="text-sm text-primary-500 hover:text-primary-700 transition-colors flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* ─── Main Upload Form ─── */}
                    <div className="lg:col-span-2">
                        <div className="card">
                            <h1 className="font-display text-2xl font-bold text-primary-900 mb-1">Upload Your Design</h1>
                            <p className="text-primary-500 mb-8">Share any jewellery reference image and we&apos;ll find matching products.</p>

                            {/* Category Selection with Images */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-primary-700 mb-3">
                                    Product Category <span className="text-gold-600">*</span>
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setCategory(cat.value)}
                                            className={`relative flex flex-col items-center gap-1.5 rounded-xl border overflow-hidden transition-all duration-200 ${category === cat.value
                                                ? 'border-gold-400 shadow-gold-glow ring-2 ring-gold-400/30'
                                                : 'border-primary-100 hover:border-primary-200'
                                                }`}
                                        >
                                            <div className="w-full overflow-hidden" style={{ aspectRatio: '1/1' }}>
                                                <img src={cat.img} alt={cat.label} className="w-full h-full object-cover" />
                                            </div>
                                            <span className={`text-xs font-medium pb-2 ${category === cat.value ? 'text-gold-700' : 'text-primary-600'}`}>
                                                {cat.label}
                                            </span>
                                            {category === cat.value && (
                                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                                    style={{ background: 'linear-gradient(135deg, #e8b931 0%, #d4a72c 100%)' }}
                                                >
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Drag & Drop Zone */}
                            <div
                                {...getRootProps()}
                                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${isDragActive
                                    ? 'border-gold-400 bg-gold-50/50'
                                    : preview
                                        ? 'border-primary-200'
                                        : 'border-primary-200 hover:border-gold-300 hover:bg-gold-50/20'
                                    }`}
                            >
                                <input {...getInputProps()} />

                                {preview ? (
                                    <div className="space-y-4">
                                        <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl shadow-luxury" />
                                        <p className="text-sm text-primary-400">Click or drag to replace this image</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                                            style={{ background: 'rgba(16,42,67,0.04)' }}
                                        >
                                            <svg className="w-8 h-8 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-medium text-primary-800">
                                                {isDragActive ? 'Drop your image here' : 'Drag & drop your jewellery image'}
                                            </p>
                                            <p className="text-sm text-primary-400 mt-1">or click to browse · JPG, PNG, WebP · max 10MB</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Optional Fields */}
                            <div className="grid md:grid-cols-2 gap-4 mt-6">
                                <div>
                                    <label className="block text-sm font-medium text-primary-700 mb-2">
                                        Max Price <span className="text-primary-300 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="1"
                                        value={maxUnitPrice}
                                        onChange={(e) => setMaxUnitPrice(e.target.value)}
                                        placeholder="e.g., 75"
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-primary-700 mb-2">
                                        Notes <span className="text-primary-300 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={context}
                                        onChange={(e) => setContext(e.target.value)}
                                        placeholder="e.g., Need this in silver"
                                        className="input"
                                    />
                                </div>
                            </div>

                            {selectedFile && category && (
                                <div className="mt-6 rounded-2xl border border-primary-100/60 bg-white p-4 sm:p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-400">AI Feature Selection</p>
                                            <h3 className="text-sm font-semibold text-primary-900 mt-1">Detected from image (Hugging Face)</h3>
                                        </div>
                                        {detectingFeatures && (
                                            <span className="text-xs text-primary-400">Detecting…</span>
                                        )}
                                    </div>

                                    {featureError && (
                                        <p className="text-xs text-red-600 mt-3">{featureError}</p>
                                    )}

                                    {!detectingFeatures && featureSuggestions.length === 0 && !featureError && (
                                        <p className="text-xs text-primary-400 mt-3">No confident features detected. You can still continue with notes.</p>
                                    )}

                                    {featureSuggestions.length > 0 && (
                                        <>
                                            <p className="text-xs text-primary-500 mt-3 mb-2">Select features to include in your request context.</p>
                                            <div className="flex flex-wrap gap-2">
                                                {featureSuggestions.map((feature) => {
                                                    const selected = selectedFeatures.includes(feature);
                                                    return (
                                                        <button
                                                            key={feature}
                                                            type="button"
                                                            onClick={() => toggleFeature(feature)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected
                                                                ? 'border-gold-300 bg-gold-50 text-gold-700'
                                                                : 'border-primary-200 text-primary-500 hover:border-primary-300'
                                                                }`}
                                                        >
                                                            {feature}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="mt-5 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading || !category}
                                className="btn-gold w-full mt-6 disabled:opacity-40 disabled:cursor-not-allowed text-base"
                            >
                                {uploading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Analysing your design...
                                    </span>
                                ) : (
                                    'Find Matching Products'
                                )}
                            </button>
                        </div>

                        {/* Tips */}
                        <div className="mt-6 grid sm:grid-cols-3 gap-3">
                            {[
                                { text: 'Use clear, well-lit images for better AI matching', icon: '💡' },
                                { text: 'Close-up shots of the jewellery work best', icon: '🔍' },
                                { text: 'Add notes for material or finish preferences', icon: '✏️' },
                            ].map((tip, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(16,42,67,0.06)' }}>
                                    <span className="text-lg">{tip.icon}</span>
                                    <span className="text-xs text-primary-600 leading-relaxed">{tip.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ─── Inspiration Sidebar ─── */}
                    <div className="hidden lg:block">
                        <div className="sticky top-24">
                            <h3 className="font-display text-lg font-bold text-primary-900 mb-1">Need Inspiration?</h3>
                            <p className="text-sm text-primary-500 mb-4">Browse these trending designs for ideas</p>

                            <div className="space-y-3">
                                {inspirationImages.map((img, i) => (
                                    <div key={i} className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-luxury-lg hover:-translate-y-0.5">
                                        <img
                                            src={img.src}
                                            alt={img.label}
                                            className="w-full rounded-2xl transition-transform duration-500 group-hover:scale-105"
                                            style={{ aspectRatio: '16/10', objectFit: 'cover' }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                            <span className="text-white text-xs font-medium">{img.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Quick Stats */}
                            <div className="mt-6 p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(16,42,67,0.03) 0%, rgba(232,185,49,0.06) 100%)', border: '1px solid rgba(232,185,49,0.12)' }}>
                                <h4 className="font-semibold text-primary-900 text-sm mb-3">Why JewelSource?</h4>
                                <div className="space-y-2.5">
                                    {[
                                        { label: 'AI-powered matching', icon: '🤖' },
                                        { label: 'Quotes within 48 hours', icon: '⚡' },
                                        { label: '10,000+ catalogue items', icon: '💎' },
                                        { label: 'Transparent pricing', icon: '✅' },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-2.5">
                                            <span className="text-sm">{item.icon}</span>
                                            <span className="text-xs text-primary-600">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
