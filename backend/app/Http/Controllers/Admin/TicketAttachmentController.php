<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TicketAttachment;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TicketAttachmentController extends Controller
{
    public function download(TicketAttachment $attachment): BinaryFileResponse
    {
        abort_unless(Storage::exists($attachment->path), 404);

        return response()->download(
            Storage::path($attachment->path),
            $attachment->original_name,
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream'],
        );
    }
}
