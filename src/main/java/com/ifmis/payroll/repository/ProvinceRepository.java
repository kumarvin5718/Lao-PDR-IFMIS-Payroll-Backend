package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.Province;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProvinceRepository extends JpaRepository<Province, String> {
    Optional<Province> findByName(String name);
}
