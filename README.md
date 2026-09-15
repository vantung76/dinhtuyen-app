# Photocopy Installments

"Tôi muốn bổ sung tính năng 'Quản lý trả góp máy photocopy' để đưa lên web (web được thiết kế trên nền tảng Wordpress). Hãy tạo các bảng dữ liệu sau:

Bảng Hợp đồng trả góp: Gồm các trường: Mã hợp đồng, Khách hàng (liên kết bảng Khách hàng), Máy photocopy (liên kết bảng Máy), Tổng giá trị máy, Số tiền trả trước, Số tháng trả góp, Lãi suất/tháng (nếu có), Ngày bắt đầu, Ngày kết thúc, Trạng thái (Đang trả góp, Đã hoàn thành, Quá hạn).

Bảng Lịch sử thanh toán: Gồm: Mã phiếu thu, Hợp đồng, Ngày đóng tiền, Số tiền đóng, Phương thức (Tiền mặt/Chuyển khoản), Nhân viên thu tiền, Ghi chú.

Hãy tự động tính toán:

Số tiền phải đóng mỗi tháng = (Tổng giá trị máy - Số tiền trả trước) / Số tháng trả góp.

Số tiền đã thanh toán = Tổng các khoản trong Lịch sử thanh toán + Số tiền trả trước.

Số nợ còn lại = Tổng giá trị máy - Số tiền đã thanh toán.

Tạo giao diện cho tài khoản Nhân viên: Họ có quyền tạo Hợp đồng mới, bấm nút 'Cập nhật thanh toán' để nhập số tiền khách vừa đóng mỗi tháng. Nhân viên không được phép xóa hợp đồng."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dinhtuyen-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/19402b13-36d1-4f34-8044-addd6010421e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
