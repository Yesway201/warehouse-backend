import { toast } from 'sonner';
import { Copy } from 'lucide-react';

interface ErrorToastOptions {
  title?: string;
  error: string | Error;
  diagnostics?: Record<string, unknown>;
  duration?: number;
}

export function showErrorToast({ title = 'Error', error, diagnostics, duration = 10000 }: ErrorToastOptions) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Combine all diagnostic info
  const fullDiagnostics = {
    message: errorMessage,
    ...(errorStack && { stack: errorStack }),
    ...(diagnostics && diagnostics),
    timestamp: new Date().toISOString(),
  };
  
  // Log full error to console for debugging
  console.error(`[${title}]`, fullDiagnostics);

  // Create copyable error text
  const copyText = `${title}: ${errorMessage}\nTimestamp: ${new Date().toISOString()}\n\nDiagnostics:\n${JSON.stringify(fullDiagnostics, null, 2)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      toast.success('Error details copied to clipboard', { duration: 2000 });
    }).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = copyText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        toast.success('Error details copied to clipboard', { duration: 2000 });
      } catch (fallbackErr) {
        toast.error('Failed to copy to clipboard', { duration: 2000 });
      }
      document.body.removeChild(textarea);
    });
  };

  // Show toast with copy button
  toast.error(
    <div className="flex items-start gap-3 w-full">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-sm mt-1 break-words">{errorMessage}</p>
        {diagnostics && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View Error Details
            </summary>
            <pre className="mt-2 p-2 bg-red-50 rounded text-red-900 overflow-auto max-h-40">
              {JSON.stringify(fullDiagnostics, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard();
        }}
        className="flex-shrink-0 p-1.5 hover:bg-red-100 rounded transition-colors"
        title="Copy error details"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>,
    {
      duration,
      className: 'cursor-default',
    }
  );
}

export function showSuccessToast(message: string, duration = 3000) {
  toast.success(message, { duration });
}